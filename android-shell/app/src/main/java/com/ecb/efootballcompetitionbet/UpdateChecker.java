package com.ecb.efootballcompetitionbet;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.SigningInfo;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.TextView;

import androidx.core.content.FileProvider;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicBoolean;

import org.json.JSONArray;
import org.json.JSONObject;

public final class UpdateChecker {
    private static final String TAG = "ECBUpdateChecker";
    // Admin-controlled release endpoint. A build is invisible until an admin
    // explicitly triggers it after testing.
    // The Supabase release-control row is the single source of truth.
    // This prevents a stale website deployment or historical static manifest
    // from showing an old release/old What's New list.
    private static final String RELEASES_URL =
        "https://udwsxqdegrtaqlbwnrqg.supabase.co/rest/v1/app_release_control"
        + "?id=eq.1&select=enabled,latest_version,latest_build,download_url,"
        + "whats_new,force_update,minimum_supported_build,updated_at";
    private static final String SUPABASE_PUBLISHABLE_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkd3N4cWRlZ3J0YXFsYnducnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxOTY0MTcsImV4cCI6MjEwMTc3MjQxN30.T2Y-mkeXqJvksELFt2TZ3YZmMldH8rk0fpnsaL_32tE";

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
            HttpURLConnection connection = null;
            try {
                URL url = new URL(RELEASES_URL + "&t=" + System.currentTimeMillis());
                connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
                connection.setReadTimeout(READ_TIMEOUT_MS);
                connection.setUseCaches(false);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0");
                connection.setRequestProperty("Pragma", "no-cache");
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("apikey", SUPABASE_PUBLISHABLE_KEY);
                connection.setRequestProperty("Authorization", "Bearer " + SUPABASE_PUBLISHABLE_KEY);

                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                    throw new IllegalStateException("HTTP " + connection.getResponseCode());
                }

                StringBuilder body = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) body.append(line);
                }

                org.json.JSONArray rows = new org.json.JSONArray(body.toString());
                if (rows.length() == 0) return;

                JSONObject release = rows.optJSONObject(0);
                if (release == null || !release.optBoolean("enabled", false)) return;

                int latestBuild = release.optInt("latest_build", 0);
                String latestVersion = release.optString("latest_version", "");
                String downloadUrl = release.optString("download_url", "");
                int minimumBuild = release.optInt("minimum_supported_build", 0);
                boolean forceUpdate = release.optBoolean("force_update", false);

                // IMPORTANT: only the current admin-controlled whats_new array is
                // rendered. There is deliberately no releaseNotes/static-manifest
                // fallback, so old What's New items cannot leak into a new release.
                String notes = formatReleaseNotes(release.opt("whats_new"));

                if (latestBuild <= BuildConfig.VERSION_CODE) return;
                if (latestVersion.isEmpty() || downloadUrl.trim().isEmpty()) return;

                boolean mandatory = forceUpdate ||
                    (minimumBuild > 0 && BuildConfig.VERSION_CODE < minimumBuild);

                showUpdateDialog(activity, latestVersion, latestBuild, notes, downloadUrl, mandatory);
            } catch (Exception error) {
                Log.w(TAG, "Release check failed", error);
            } finally {
                if (connection != null) connection.disconnect();
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

            View view = LayoutInflater.from(activity).inflate(R.layout.dialog_update, null);
            ((TextView) view.findViewById(R.id.update_title))
                .setText(mandatory ? "UPDATE REQUIRED" : "NEW UPDATE AVAILABLE");
            ((TextView) view.findViewById(R.id.update_version))
                .setText("VERSION " + version + "  •  BUILD " + build);
            ((TextView) view.findViewById(R.id.update_notes))
                .setText(notes.isEmpty() ? "• Performance and stability improvements." : notes);

            AlertDialog dialog = new AlertDialog.Builder(activity)
                .setView(view)
                .setCancelable(!mandatory)
                .create();

            view.findViewById(R.id.update_later).setOnClickListener(v -> {
                if (!mandatory) dialog.dismiss();
            });
            view.findViewById(R.id.update_install).setOnClickListener(v -> {
                dialog.dismiss();
                downloadAndInstall(activity, version, downloadUrl, mandatory);
            });

            dialog.setOnDismissListener(d -> showing = false);
            dialog.setOnShowListener(d -> {
                Window window = dialog.getWindow();
                if (window != null) {
                    window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
                    WindowManager.LayoutParams params = window.getAttributes();
                    params.width = (int) (activity.getResources().getDisplayMetrics().widthPixels * 0.92f);
                    params.dimAmount = 0.68f;
                    window.setAttributes(params);
                    window.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
                }
            });
            dialog.show();
        });
    }

    private static void downloadAndInstall(Activity activity, String version,
                                           String downloadUrl, boolean mandatory) {
        new Thread(() -> {
            HttpURLConnection connection = null;
            FileOutputStream output = null;
            File apk = null;
            try {
                File dir = new File(activity.getFilesDir(), "updates");
                if (!dir.exists() && !dir.mkdirs()) {
                    throw new IllegalStateException("Cannot create update directory");
                }

                apk = new File(dir, "efootball-update-" + version + ".apk");
                connection = (HttpURLConnection) new URL(downloadUrl).openConnection();
                connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
                connection.setReadTimeout(60000);
                connection.setInstanceFollowRedirects(true);
                connection.setUseCaches(false);
                connection.setRequestProperty("Cache-Control", "no-cache");
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

                PackageManager pm = activity.getPackageManager();
                PackageInfo archive = pm.getPackageArchiveInfo(
                    apk.getAbsolutePath(),
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                        ? PackageManager.GET_SIGNING_CERTIFICATES
                        : PackageManager.GET_SIGNATURES
                );

                if (archive == null) throw new IllegalStateException("Android could not read the downloaded APK.");
                if (!activity.getPackageName().equals(archive.packageName)) {
                    throw new IllegalStateException("The update package does not belong to this app.");
                }

                long installedBuild = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? pm.getPackageInfo(activity.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES).getLongVersionCode()
                    : pm.getPackageInfo(activity.getPackageName(), 0).versionCode;
                long downloadedBuild = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? archive.getLongVersionCode()
                    : archive.versionCode;

                if (downloadedBuild <= installedBuild) {
                    throw new IllegalStateException(
                        "Downloaded version " + downloadedBuild + " is not newer than installed build " + installedBuild + "."
                    );
                }

                // Android only permits an in-place update when the signing certificate
                // matches the installed application. Catch that before launching the
                // system installer so the user gets a useful message instead of a
                // generic "Installing..." dialog that silently stops.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    PackageInfo installed = pm.getPackageInfo(
                        activity.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
                    SigningInfo installedSigning = installed.signingInfo;
                    SigningInfo archiveSigning = archive.signingInfo;
                    if (installedSigning != null && archiveSigning != null) {
                        boolean same = Arrays.equals(
                            installedSigning.getApkContentsSigners(),
                            archiveSigning.getApkContentsSigners()
                        );
                        if (!same) {
                            throw new IllegalStateException(
                                "The downloaded update is signed with a different Android signing key. " +
                                "This build cannot replace the installed app without uninstalling it."
                            );
                        }
                    }
                }

                Uri uri = FileProvider.getUriForFile(
                    activity, activity.getPackageName() + ".fileprovider", apk);

                new Handler(Looper.getMainLooper()).post(() -> {
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                            !activity.getPackageManager().canRequestPackageInstalls()) {
                            new AlertDialog.Builder(activity)
                                .setTitle("Allow app updates")
                                .setMessage("Android needs permission to install updates downloaded by E-Football Competition Bet. Enable 'Allow from this source', then return to the app and tap Install again.")
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
                        activity.startActivityForResult(install, 9101);
                    } catch (Exception error) {
                        Log.e(TAG, "Installer launch failed", error);
                        showInstallError(activity, error.getMessage());
                    }
                });
            } catch (Exception error) {
                Log.e(TAG, "APK download/validation failed", error);
                String message = error.getMessage() == null
                    ? "The update could not be installed."
                    : error.getMessage();
                new Handler(Looper.getMainLooper()).post(() -> showInstallError(activity, message));
            } finally {
                if (output != null) try { output.close(); } catch (Exception ignored) {}
                if (connection != null) connection.disconnect();
            }
        }, "ECB-ApkDownloader").start();
    }

    private static void showInstallError(Activity activity, String message) {
        if (activity.isFinishing()) return;
        new AlertDialog.Builder(activity)
            .setTitle("Update could not be installed")
            .setMessage(message + "\n\nNo app data has been deleted.")
            .setPositiveButton("OK", null)
            .show();
    }
}
