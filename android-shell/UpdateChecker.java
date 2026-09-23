package com.ecb.efootballcompetitionbet;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.atomic.AtomicBoolean;

public final class UpdateChecker {
    private static final String MANIFEST =
        "https://raw.githubusercontent.com/lomita483-del/efootballcompetitionbet/main/public/app-release.json";
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static boolean dialogShowing = false;
    private static final AtomicBoolean checking = new AtomicBoolean(false);

    private UpdateChecker() {}

    public static void check(Activity activity, boolean forceNetwork) {
        if (activity == null || activity.isFinishing() || dialogShowing) return;
        if (!checking.compareAndSet(false, true)) return;

        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(MANIFEST + "?t=" + System.currentTimeMillis());
                conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.setUseCaches(false);
                conn.setRequestProperty("Cache-Control", "no-cache, no-store");
                conn.setRequestProperty("Pragma", "no-cache");

                if (conn.getResponseCode() != HttpURLConnection.HTTP_OK) return;

                StringBuilder body = new StringBuilder();
                try (InputStream in = conn.getInputStream()) {
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = in.read(buffer)) != -1) {
                        body.append(new String(buffer, 0, count, java.nio.charset.StandardCharsets.UTF_8));
                    }
                }

                JSONObject json = new JSONObject(body.toString());
                int latestBuild = json.optInt("latestBuild", 0);
                int minimumBuild = json.optInt("minimumSupportedBuild", 0);
                boolean forceUpdate = json.optBoolean("forceUpdate", false);
                String version = json.optString("latestVersion", "");
                String downloadUrl = json.optString("downloadUrl", "");
                String notes = joinNotes(json.optJSONArray("releaseNotes"));

                int currentBuild = BuildConfig.VERSION_CODE;
                if (latestBuild <= currentBuild) return;

                boolean mandatory = forceUpdate || (minimumBuild > 0 && currentBuild < minimumBuild);
                MAIN.post(() -> showUpdateDialog(activity, version, notes, downloadUrl, mandatory));
            } catch (Exception ignored) {
            } finally {
                if (conn != null) conn.disconnect();
                checking.set(false);
            }
        }).start();
    }

    private static String joinNotes(JSONArray notes) {
        if (notes == null || notes.length() == 0) return "";
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < notes.length(); i++) {
            if (i > 0) out.append("\n");
            out.append("• ").append(notes.optString(i));
        }
        return out.toString();
    }

    private static void showUpdateDialog(
        Activity activity,
        String version,
        String notes,
        String downloadUrl,
        boolean mandatory
    ) {
        if (activity.isFinishing() || dialogShowing) return;
        dialogShowing = true;

        String title = mandatory ? "Update required" : "New update available";
        String message = "E-Football Competition Bet " + version +
            " is available.\n\n" +
            (notes.isEmpty() ? "Install the latest version to keep the app current." : notes) +
            "\n\nYour account data remains in the app and is not cleared by an app update.";

        AlertDialog dialog = new AlertDialog.Builder(activity)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("Install update", null)
            .setNegativeButton("Cancel", mandatory ? null : (d, which) -> {})
            .setCancelable(!mandatory)
            .create();

        dialog.setOnShowListener(d -> {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
                dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(false);
                dialog.setMessage("Downloading update…");
                downloadAndInstall(activity, dialog, downloadUrl);
            });
        });

        dialog.setOnDismissListener(d -> {
            dialogShowing = false;
            if (mandatory) {
                MAIN.postDelayed(() -> check(activity, true), 1500);
            }
        });

        dialog.setCanceledOnTouchOutside(!mandatory);
        dialog.show();
    }

    private static void downloadAndInstall(Activity activity, AlertDialog dialog, String downloadUrl) {
        new Thread(() -> {
            HttpURLConnection conn = null;
            FileOutputStream output = null;
            try {
                if (downloadUrl == null || downloadUrl.isEmpty()) {
                    throw new IllegalArgumentException("Missing update download URL");
                }

                File updatesDir = new File(activity.getFilesDir(), "updates");
                if (!updatesDir.exists() && !updatesDir.mkdirs()) {
                    throw new IllegalStateException("Unable to create update directory");
                }

                File apk = new File(updatesDir, "efootball-competition-bet-update.apk");
                if (apk.exists()) apk.delete();

                URL url = new URL(downloadUrl);
                conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.setInstanceFollowRedirects(true);
                conn.setUseCaches(false);
                conn.setRequestProperty("Cache-Control", "no-cache");

                if (conn.getResponseCode() != HttpURLConnection.HTTP_OK) {
                    throw new IllegalStateException("Download failed: HTTP " + conn.getResponseCode());
                }

                long total = conn.getContentLengthLong();
                long downloaded = 0;

                try (InputStream input = new BufferedInputStream(conn.getInputStream())) {
                    output = new FileOutputStream(apk);
                    byte[] buffer = new byte[16384];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        output.write(buffer, 0, count);
                        downloaded += count;
                        if (total > 0) {
                            int percent = (int) Math.min(100, (downloaded * 100L) / total);
                            final int p = percent;
                            MAIN.post(() -> dialog.setMessage("Downloading update… " + p + "%"));
                        }
                    }
                    output.flush();
                } finally {
                    if (output != null) {
                        try { output.close(); } catch (Exception ignored) {}
                        output = null;
                    }
                }

                if (!apk.exists() || apk.length() < 100_000) {
                    throw new IllegalStateException("Downloaded APK is incomplete");
                }

                Uri uri = FileProvider.getUriForFile(
                    activity,
                    activity.getPackageName() + ".fileprovider",
                    apk
                );

                MAIN.post(() -> {
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                            !activity.getPackageManager().canRequestPackageInstalls()) {
                            Intent settingsIntent = new Intent(
                                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + activity.getPackageName())
                            );
                            activity.startActivity(settingsIntent);
                            dialog.dismiss();
                            return;
                        }

                        Intent install = new Intent(Intent.ACTION_INSTALL_PACKAGE);
                        install.setDataAndType(uri, "application/vnd.android.package-archive");
                        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        activity.startActivity(install);
                        dialog.dismiss();
                    } catch (Exception e) {
                        dialog.setMessage("Could not open the Android installer. Please try again.");
                        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);
                        dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(true);
                    }
                });
            } catch (Exception e) {
                MAIN.post(() -> {
                    dialog.setMessage("Update download failed. Please check your connection and try again.");
                    dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);
                    dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(true);
                });
            } finally {
                if (conn != null) conn.disconnect();
                if (output != null) {
                    try { output.close(); } catch (Exception ignored) {}
                }
            }
        }).start();
    }
}
