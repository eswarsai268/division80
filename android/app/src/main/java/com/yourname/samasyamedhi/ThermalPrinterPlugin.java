package com.yourname.samasyamedhi;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import android.content.pm.PackageManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.BufferedOutputStream;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "ThermalPrinter",
    permissions = {
        @Permission(alias = "bluetoothConnect", strings = { Manifest.permission.BLUETOOTH_CONNECT })
    }
)
public class ThermalPrinterPlugin extends Plugin {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int MAX_IMAGES = 5;
    private static final int MAX_TOTAL_IMAGE_CHARS = 8_000_000;
    private static final int MAX_IMAGE_HEIGHT = 4_000;
    private static final ExecutorService PRINT_EXECUTOR = Executors.newSingleThreadExecutor();
    private static final ScheduledExecutorService TIMEOUT_EXECUTOR = Executors.newSingleThreadScheduledExecutor();

    @PluginMethod
    public void getPairedDevices(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("bluetoothConnect") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetoothConnect", call, "pairedDevicesPermissionCallback");
            return;
        }
        resolvePairedDevices(call);
    }

    @PermissionCallback
    public void pairedDevicesPermissionCallback(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("bluetoothConnect") != PermissionState.GRANTED) {
            call.reject("Bluetooth permission is required to list paired printers.", "BLUETOOTH_PERMISSION_DENIED");
            return;
        }
        resolvePairedDevices(call);
    }

    private void resolvePairedDevices(PluginCall call) {
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("This phone does not support Bluetooth.", "BLUETOOTH_UNAVAILABLE");
                return;
            }
            if (!adapter.isEnabled()) {
                call.reject("Turn on Bluetooth, then try again.", "BLUETOOTH_DISABLED");
                return;
            }

            JSArray devices = new JSArray();
            Set<BluetoothDevice> bondedDevices = adapter.getBondedDevices();
            for (BluetoothDevice device : bondedDevices) {
                JSObject item = new JSObject();
                item.put("name", device.getName() == null ? "Bluetooth device" : device.getName());
                item.put("address", device.getAddress());
                devices.put(item);
            }
            JSObject result = new JSObject();
            result.put("devices", devices);
            call.resolve(result);
        } catch (SecurityException error) {
            call.reject("Allow Bluetooth access to list paired printers.", "BLUETOOTH_PERMISSION_DENIED");
        } catch (Exception error) {
            call.reject("Could not read paired Bluetooth devices.", "BLUETOOTH_LIST_FAILED");
        }
    }

    @PluginMethod
    public void openBluetoothSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not open Bluetooth settings.", "BLUETOOTH_SETTINGS_FAILED");
        }
    }

    @PluginMethod
    public void printImages(PluginCall call) {
        String address = call.getString("address");
        JSArray imageValues = call.getArray("images");
        if (address == null || !BluetoothAdapter.checkBluetoothAddress(address) || imageValues == null || imageValues.length() < 1 || imageValues.length() > MAX_IMAGES) {
            call.reject("Select a paired printer and one to five slips.", "INVALID_PRINT_REQUEST");
            return;
        }

        final JSONArray images = imageValues;
        PRINT_EXECUTOR.execute(() -> printImagesOnWorker(call, address, images));
    }

    private void printImagesOnWorker(PluginCall call, String address, JSONArray imageValues) {
        BluetoothSocket socket = null;
        ScheduledFuture<?> timeout = null;
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                call.reject("Allow Bluetooth access before printing.", "BLUETOOTH_PERMISSION_DENIED");
                return;
            }
            if (adapter == null || !adapter.isEnabled()) {
                call.reject("Turn on Bluetooth, then try again.", "BLUETOOTH_DISABLED");
                return;
            }

            boolean isPaired = false;
            for (BluetoothDevice paired : adapter.getBondedDevices()) {
                if (address.equalsIgnoreCase(paired.getAddress())) {
                    isPaired = true;
                    break;
                }
            }
            if (!isPaired) {
                call.reject("Pair this printer in Bluetooth settings, then select it again.", "PRINTER_NOT_PAIRED");
                return;
            }

            BluetoothDevice printer = adapter.getRemoteDevice(address);
            socket = printer.createRfcommSocketToServiceRecord(SPP_UUID);
            final BluetoothSocket connectingSocket = socket;
            timeout = TIMEOUT_EXECUTOR.schedule(() -> closeQuietly(connectingSocket), 15, TimeUnit.SECONDS);
            socket.connect();
            timeout.cancel(false);
            timeout = null;

            OutputStream output = new BufferedOutputStream(socket.getOutputStream());
            output.write(new byte[] { 0x1b, 0x40 }); // ESC @: initialize ESC/POS printer.
            int totalChars = 0;
            for (int index = 0; index < imageValues.length(); index++) {
                JSONObject imageObject = imageValues.optJSONObject(index);
                String dataUrl = imageObject == null ? null : imageObject.optString("data", null);
                if (dataUrl == null || !dataUrl.startsWith("data:image/png;base64,")) {
                    throw new IllegalArgumentException("Invalid slip image.");
                }
                String encoded = dataUrl.substring("data:image/png;base64,".length());
                totalChars += encoded.length();
                if (totalChars > MAX_TOTAL_IMAGE_CHARS) {
                    throw new IllegalArgumentException("Print batch is too large.");
                }
                byte[] png = android.util.Base64.decode(encoded, android.util.Base64.DEFAULT);
                BitmapFactory.Options bounds = new BitmapFactory.Options();
                bounds.inJustDecodeBounds = true;
                BitmapFactory.decodeByteArray(png, 0, png.length, bounds);
                if (bounds.outWidth != 384 || bounds.outHeight < 1 || bounds.outHeight > MAX_IMAGE_HEIGHT) {
                    throw new IllegalArgumentException("Slip image dimensions are not supported.");
                }
                BitmapFactory.Options bitmapOptions = new BitmapFactory.Options();
                bitmapOptions.inPreferredConfig = Bitmap.Config.RGB_565;
                Bitmap bitmap = BitmapFactory.decodeByteArray(png, 0, png.length, bitmapOptions);
                if (bitmap == null) {
                    if (bitmap != null) bitmap.recycle();
                    throw new IllegalArgumentException("Slip image dimensions are not supported.");
                }
                try {
                    writeRasterImage(output, bitmap);
                } finally {
                    bitmap.recycle();
                }
                output.write(new byte[] { 0x1b, 0x64, 0x03 }); // Feed three lines; no cutter command is assumed.
            }
            output.flush();
            call.resolve();
        } catch (SecurityException error) {
            call.reject("Allow Bluetooth access and try again.", "BLUETOOTH_PERMISSION_DENIED");
        } catch (IllegalArgumentException error) {
            call.reject(error.getMessage(), "INVALID_PRINT_IMAGE");
        } catch (Exception error) {
            call.reject("Could not print. Check that the printer is on, paired, and supports ESC/POS Bluetooth printing.", "PRINTER_CONNECTION_FAILED");
        } finally {
            if (timeout != null) timeout.cancel(false);
            closeQuietly(socket);
        }
    }

    private static void writeRasterImage(OutputStream output, Bitmap bitmap) throws Exception {
        int widthBytes = (bitmap.getWidth() + 7) / 8;
        int height = bitmap.getHeight();
        output.write(new byte[] {
            0x1d, 0x76, 0x30, 0x00,
            (byte) (widthBytes & 0xff), (byte) ((widthBytes >> 8) & 0xff),
            (byte) (height & 0xff), (byte) ((height >> 8) & 0xff)
        });
        byte[] row = new byte[widthBytes];
        for (int y = 0; y < height; y++) {
            java.util.Arrays.fill(row, (byte) 0);
            for (int x = 0; x < bitmap.getWidth(); x++) {
                int color = bitmap.getPixel(x, y);
                int luminance = ((color >> 16 & 0xff) * 299 + (color >> 8 & 0xff) * 587 + (color & 0xff) * 114) / 1000;
                if (luminance < 190) row[x / 8] |= (byte) (0x80 >> (x % 8));
            }
            output.write(row);
        }
    }

    private static void closeQuietly(BluetoothSocket socket) {
        if (socket == null) return;
        try {
            socket.close();
        } catch (Exception ignored) {
            // Socket cleanup is best effort after a completed or timed-out job.
        }
    }
}
