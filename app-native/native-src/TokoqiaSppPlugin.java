package PACKAGE_PLACEHOLDER;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.Build;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Bluetooth Classic (SPP/RFCOMM) untuk printer thermal - HANYA Android.
 * Mengirim byte ESC/POS mentah (base64 dari JavaScript). Printer harus sudah dipasangkan (pair) di Pengaturan Bluetooth HP.
 * BELUM TERBUKTI di perangkat nyata sampai dibangun dan dicoba ke printer.
 */
@CapacitorPlugin(
    name = "TokoqiaSpp",
    permissions = { @Permission(alias = "btconnect", strings = { Manifest.permission.BLUETOOTH_CONNECT }) }
)
public class TokoqiaSppPlugin extends Plugin {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private BluetoothSocket socket;
    private OutputStream out;

    private boolean needsPermission() {
        return Build.VERSION.SDK_INT >= 31 && getPermissionState("btconnect") != PermissionState.GRANTED;
    }

    @PluginMethod
    public void listBonded(PluginCall call) {
        if (needsPermission()) {
            requestPermissionForAlias("btconnect", call, "permissionCallback");
            return;
        }
        doListBonded(call);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (needsPermission()) {
            requestPermissionForAlias("btconnect", call, "permissionCallback");
            return;
        }
        doConnect(call);
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (needsPermission()) {
            call.reject("Izin Bluetooth ditolak. Izinkan 'Perangkat sekitar' untuk TOKOQIA di Pengaturan HP.");
            return;
        }
        if ("connect".equals(call.getMethodName())) doConnect(call);
        else doListBonded(call);
    }

    @SuppressLint("MissingPermission")
    private void doListBonded(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) { call.reject("Perangkat ini tidak punya Bluetooth."); return; }
        if (!adapter.isEnabled()) { call.reject("Bluetooth mati. Nyalakan Bluetooth lalu coba lagi."); return; }
        try {
            JSArray arr = new JSArray();
            Set<BluetoothDevice> bonded = adapter.getBondedDevices();
            for (BluetoothDevice d : bonded) {
                JSObject o = new JSObject();
                o.put("name", d.getName());
                o.put("address", d.getAddress());
                arr.put(o);
            }
            JSObject res = new JSObject();
            res.put("devices", arr);
            call.resolve(res);
        } catch (SecurityException e) {
            call.reject("Izin Bluetooth belum diberikan.");
        }
    }

    /**
     * Mencoba beberapa cara menyambung (printer thermal murah tidak seragam): UUID standar, UUID tanpa pairing aman
     * (insecure), lalu kanal RFCOMM 1 lewat refleksi. Jeda singkat antar percobaan supaya printer sempat melepas kanal lama.
     */
    @SuppressLint("MissingPermission")
    private BluetoothSocket openSocket(BluetoothDevice device) throws IOException {
        IOException first = null;
        for (int attempt = 0; attempt < 3; attempt++) {
            BluetoothSocket s = null;
            try {
                if (attempt == 0) s = device.createRfcommSocketToServiceRecord(SPP_UUID);
                else if (attempt == 1) s = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
                else s = (BluetoothSocket) device.getClass().getMethod("createRfcommSocket", int.class).invoke(device, 1);
                s.connect();
                return s;
            } catch (IOException e) {
                if (first == null) first = e;
                try { if (s != null) s.close(); } catch (IOException ignore) { }
            } catch (Exception other) {
                try { if (s != null) s.close(); } catch (IOException ignore) { }
            }
            try { Thread.sleep(700); } catch (InterruptedException ie) { break; }
        }
        throw (first != null ? first : new IOException("tidak bisa membuka kanal Bluetooth"));
    }

    @SuppressLint("MissingPermission")
    private void doConnect(final PluginCall call) {
        final String address = call.getString("address");
        if (address == null || address.isEmpty()) { call.reject("Alamat printer kosong."); return; }
        io.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    boolean hadOld = socket != null;
                    closeQuietly();
                    if (hadOld) { try { Thread.sleep(600); } catch (InterruptedException ie) { } } // beri waktu printer melepas sambungan lama
                    BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                    if (adapter == null || !adapter.isEnabled()) { call.reject("Bluetooth mati. Nyalakan Bluetooth lalu coba lagi."); return; }
                    adapter.cancelDiscovery();
                    BluetoothSocket s = openSocket(adapter.getRemoteDevice(address));
                    socket = s;
                    out = s.getOutputStream();
                    call.resolve();
                } catch (Exception e) {
                    closeQuietly();
                    call.reject("Gagal menyambung ke printer: " + e.getMessage());
                }
            }
        });
    }

    @PluginMethod
    public void write(final PluginCall call) {
        final String data = call.getString("data");
        if (data == null) { call.reject("Data kosong."); return; }
        io.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    if (socket == null || out == null || !socket.isConnected()) { call.reject("Printer belum tersambung."); return; }
                    byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                    int i = 0;
                    while (i < bytes.length) {
                        int n = Math.min(512, bytes.length - i);
                        out.write(bytes, i, n);
                        out.flush();
                        i += n;
                        Thread.sleep(10);
                    }
                    call.resolve();
                } catch (Exception e) {
                    closeQuietly();
                    call.reject("Gagal mengirim data ke printer: " + e.getMessage());
                }
            }
        });
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        closeQuietly();
        call.resolve();
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        JSObject res = new JSObject();
        res.put("connected", socket != null && socket.isConnected());
        call.resolve(res);
    }

    private void closeQuietly() {
        try { if (out != null) out.close(); } catch (IOException ignore) { }
        try { if (socket != null) socket.close(); } catch (IOException ignore) { }
        out = null;
        socket = null;
    }
}
