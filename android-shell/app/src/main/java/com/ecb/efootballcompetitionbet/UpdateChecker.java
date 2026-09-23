package com.ecb.efootballcompetitionbet;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.FileProvider;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;

import org.json.JSONArray;
import org.json.JSONObject;

public final class UpdateChecker {
    private static final String TAG = "ECBUpdateChecker";
    private static final String[] MANIFESTS = {
        "https://raw.githubusercontent.com/lomita483-del/efootballcompetitionbetting/main/public/app-release.json",
        "https://cdn.jsdelivr.net/gh/lomita483-del/efootballcompetitionbetting@main/public/app-release.json",
        "https://lslonlinebetting.lovable.app/app-release.json"
    };
    private static final int MAX_ATTEMPTS = 3;
    private static final int CONNECT_TIMEOUT_MS = 8000;
    private static final int READ_TIMEOUT_MS = 12000;
    private static final AtomicBoolean checking = new AtomicBoolean(false);
    private static boolean showing;

    private UpdateChecker() {}

    public static void check(Activity activity) {
        if (activity == null || activity.isFinishing() || showing) return;
        if (!checking.compareAndSet(false, true)) return;

        new Thread(() -> {
            try {
                for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                    int bestBuild = -1, bestMinimumBuild = 0;
                    String bestVersion = "", bestDownloadUrl = "", bestNotes = "";
                    boolean bestForceUpdate = false, receivedManifest = false;

                    for (String manifestUrl : MANIFESTS) {
                        HttpURLConnection connection = null;
                        try {
                            URL url = new URL(manifestUrl + "?t=" + System.currentTimeMillis());
                            connection = (HttpURLConnection) url.openConnection();
                            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
                            connection.setReadTimeout(READ_TIMEOUT_MS);
                            connection.setUseCaches(false);
                            connection.setInstanceFollowRedirects(true);
                            connection.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0");
                            connection.setRequestProperty("Pragma", "no-cache");
                            connection.setRequestProperty("Accept", "application/json");

                            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                                throw new IllegalStateException("HTTP " + connection.getResponseCode());
                            }

                            StringBuilder body = new StringBuilder();
                            try (BufferedReader reader = new BufferedReader(
                                    new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                                String line;
                                while ((line = reader.readLine()) != null) body.append(line);
                            }

                            JSONObject manifest = new JSONObject(body.toString());
                            int latestBuild = manifest.optInt("latestBuild", 0);
                            receivedManifest = true;

                            if (latestBuild > bestBuild) {
                                bestBuild = latestBuild;
                                bestMinimumBuild = manifest.optInt("minimumSupportedBuild", 0);
                                bestVersion = manifest.optString("latestVersion", "new version");
                                bestDownloadUrl = manifest.optString("downloadUrl", "");
                                bestNotes = formatReleaseNotes(manifest.opt("releaseNotes"));
                                bestForceUpdate = manifest.optBoolean("forceUpdate", false);
                            }
                        } catch (Exception error) {
                            Log.w(TAG, "Manifest failed: " + manifestUrl, error);
                        } finally {
                            if (connection != null) connection.disconnect();
                        }
                    }

                    if (receivedManifest && bestBuild > BuildConfig.VERSION_CODE) {
                        boolean mandatory = bestForceUpdate ||
                            (bestMinimumBuild > 0 && BuildConfig.VERSION_CODE < bestMinimumBuild);
                        showUpdateDialog(activity, bestVersion, bestBuild, bestNotes, bestDownloadUrl, mandatory);
                        return;
                    }

                    if (receivedManifest) return;

                    if (attempt < MAX_ATTEMPTS) {
                        try { Thread.sleep(1200L * attempt); }
                        catch (InterruptedException e) { Thread.currentThread().interrupt(); return; }
                    }
                }
            } finally {
                checking.set(false);
            }
        }, "ECB-UpdateChecker").start();
    }

    private static String formatReleaseNotes(Object value) {
        if (!(value instanceof JSONArray)) return value == null ? "" : String.valueOf(value);
        JSONArray array = (JSONArray) value;
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < array.length(); i++) {
            String item = array.optString(i, "");
            if (item.isEmpty()) continue;
            if (out.length() > 0) out.append("\n");
            out.append("• ").append(item);
        }
        return out.toString();
    }

    private static void showUpdateDialog(Activity activity, String version, int build,
                                         String notes, String downloadUrl, boolean mandatory) {
        new Handler(Looper.getMainLooper()).post(() -> {
            if (activity.isFinishing() || showing || downloadUrl.isEmpty()) return;
            showing = true;

            String message = "Version " + version + " (build " + build + ") is available.";
            if (!notes.isEmpty()) message += "\n\n" + notes;
            message += "\n\nYour account data stays in the app and is not cleared by an update.";

            AlertDialog dialog = new AlertDialog.Builder(activity)
                .setTitle(mandatory ? "Update required" : "New update available")
                .setMessage(message)
                .setPositiveButton("Download & install",
                    (d, w) -> downloadAndInstall(activity, version, downloadUrl, mandatory))
                .setNegativeButton(mandatory ? null : "Later", null)
                .setCancelable(!mandatory)
                .create();

            dialog.setOnDismissListener(d -> showing = false);
            dialog.show();
        });
    }

    private static void downloadAndInstall(Activity activity, String version,
                                           String downloadUrl, boolean mandatory) {
        new Thread(() -> {
            HttpURLConnection connection = null;
            FileOutputStream output = null;
            try {
                File dir = new File(activity.getFilesDir(), "updates");
                if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Cannot create update directory");

                File apk = new File(dir, "efootball-update-" + version + ".apk");
                connection = (HttpURLConnection) new URL(downloadUrl).openConnection();
                connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
                connection.setReadTimeout(60000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent", "EFootballCompetitionBet/" + BuildConfig.VERSION_NAME);

                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                    throw new IllegalStateException("APK download HTTP " + connection.getResponseCode());
                }

                try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream())) {
                    output = new FileOutputStream(apk);
                    byte[] buffer = new byte[8192];
                    int count;
                    long total = 0;
                    while ((count = input.read(buffer)) != -1) {
                        output.write(buffer, 0, count);
                        total += count;
                    }
                    output.flush();
                    if (total < 100000) throw new IllegalStateException("Invalid APK download");
                }

                Uri uri = FileProvider.getUriForFile(
                    activity, activity.getPackageName() + ".fileprovider", apk);

                new Handler(Looper.getMainLooper()).post(() -> {
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                            !activity.getPackageManager().canRequestPackageInstalls()) {
                            new AlertDialog.Builder(activity)
                                .setTitle("Allow app updates")
                                .setMessage("Android needs permission to install updates downloaded by E-Football Competition Bet. Enable 'Allow from this source', then return to the app.")
                                .setPositiveButton("Open settings", (d, w) -> {
                                    Intent settings = new Intent(
                                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                        Uri.parse("package:" + activity.getPackageName()));
                                    activity.startActivity(settings);
                                })
                                .setNegativeButton(mandatory ? null : "Later", null)
                                .show();
                            return;
                        }

                        Intent install = new Intent(Intent.ACTION_INSTALL_PACKAGE);
                        install.setDataAndType(uri, "application/vnd.android.package-archive");
                        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        install.putExtra(Intent.EXTRA_RETURN_RESULT, true);
                        activity.startActivity(install);
                    } catch (Exception error) {
                        Log.e(TAG, "Installer launch failed", error);
                    }
                });
            } catch (Exception error) {
                Log.e(TAG, "APK download failed", error);
                new Handler(Looper.getMainLooper()).post(() ->
                    new AlertDialog.Builder(activity)
                        .setTitle("Update download failed")
                        .setMessage("The latest update could not be downloaded. Please try again.")
                        .setPositiveButton("OK", null)
                        .show());
            } finally {
                if (output != null) try { output.close(); } catch (Exception ignored) {}
                if (connection != null) connection.disconnect();
            }
        }, "ECB-ApkDownloader").start();
    }
}
