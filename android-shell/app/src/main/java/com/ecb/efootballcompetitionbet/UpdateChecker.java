package com.ecb.efootballcompetitionbet;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;

import org.json.JSONArray;
import org.json.JSONObject;

public final class UpdateChecker { // release rebuild includes the latest Android UI and launcher fixes
    private static final String TAG = "ECBUpdateChecker";
    private static final String[] MANIFESTS = {
        "https://raw.githubusercontent.com/lomita483-del/efootballcompetitionbetting/main/public/app-release.json",
        "https://cdn.jsdelivr.net/gh/lomita483-del/efootballcompetitionbetting@main/public/app-release.json"
    };
    private static final int MAX_ATTEMPTS = 3;
    private static final int CONNECT_TIMEOUT_MS = 10000;
    private static final int READ_TIMEOUT_MS = 10000;

    private static final AtomicBoolean checking = new AtomicBoolean(false);
    private static boolean showing;

    private UpdateChecker() {}

    public static void check(Activity activity) {
        if (activity == null || activity.isFinishing() || showing) return;
        if (!checking.compareAndSet(false, true)) return;

        new Thread(() -> {
            try {
                Exception lastError = null;

                for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                    for (String manifest : MANIFESTS) {
                        HttpURLConnection connection = null;
                        try {
                            URL url = new URL(manifest + "?t=" + System.currentTimeMillis());
                            connection = (HttpURLConnection) url.openConnection();
                            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
                            connection.setReadTimeout(READ_TIMEOUT_MS);
                            connection.setUseCaches(false);
                            connection.setInstanceFollowRedirects(true);
                            connection.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0");
                            connection.setRequestProperty("Pragma", "no-cache");
                            connection.setRequestProperty("Accept", "application/json");
                            connection.setRequestProperty("User-Agent",
                                "EFootballCompetitionBet/" + BuildConfig.VERSION_NAME);

                            int status = connection.getResponseCode();
                            if (status != HttpURLConnection.HTTP_OK) {
                                throw new IllegalStateException("Update manifest HTTP " + status);
                            }

                            StringBuilder body = new StringBuilder();
                            try (BufferedReader reader = new BufferedReader(
                                    new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                                String line;
                                while ((line = reader.readLine()) != null) body.append(line);
                            }

                            JSONObject manifestJson = new JSONObject(body.toString());
                            int latestBuild = manifestJson.optInt("latestBuild", 0);
                            int minimumBuild = manifestJson.optInt("minimumSupportedBuild", 0);

                            Log.d(TAG, "Manifest check: installed build=" + BuildConfig.VERSION_CODE
                                + ", latest build=" + latestBuild);

                            if (latestBuild <= BuildConfig.VERSION_CODE) {
                                // This is important: a successful no-update check must NOT
                                // leave the global 'checking' flag stuck forever.
                                return;
                            }

                            String latestVersion = manifestJson.optString("latestVersion", "new version");
                            String downloadUrl = manifestJson.optString("downloadUrl", "");
                            boolean mandatory = manifestJson.optBoolean("forceUpdate", false)
                                || (minimumBuild > 0 && BuildConfig.VERSION_CODE < minimumBuild);

                            String notes = formatReleaseNotes(manifestJson.opt("releaseNotes"));
                            showUpdateDialog(activity, latestVersion, latestBuild, notes, downloadUrl, mandatory);
                            return;
                        } catch (Exception error) {
                            lastError = error;
                            Log.w(TAG, "Update manifest failed from " + manifest + " (attempt " + attempt + ")", error);
                        } finally {
                            if (connection != null) connection.disconnect();
                        }
                    }

                    if (attempt < MAX_ATTEMPTS) {
                        try {
                            Thread.sleep(1200L * attempt);
                        } catch (InterruptedException interrupted) {
                            Thread.currentThread().interrupt();
                            return;
                        }
                    }
                }

                if (lastError != null) {
                    Log.w(TAG, "Update check failed after all attempts", lastError);
                }
            } finally {
                // Always unlock future checks, including no-update and failure paths.
                checking.set(false);
            }
        }, "ECB-UpdateChecker").start();
    }

    private static String formatReleaseNotes(Object value) {
        if (value instanceof JSONArray) {
            JSONArray array = (JSONArray) value;
            StringBuilder notes = new StringBuilder();
            for (int i = 0; i < array.length(); i++) {
                String item = array.optString(i, "");
                if (item.isEmpty()) continue;
                if (notes.length() > 0) notes.append("\n");
                notes.append("• ").append(item);
            }
            return notes.toString();
        }
        return value == null ? "" : String.valueOf(value);
    }

    private static void showUpdateDialog(
        Activity activity,
        String version,
        int build,
        String notes,
        String downloadUrl,
        boolean mandatory
    ) {
        new Handler(Looper.getMainLooper()).post(() -> {
            if (activity.isFinishing() || showing) return;
            if (downloadUrl.isEmpty()) {
                Log.w(TAG, "Update detected but manifest has no downloadUrl");
                return;
            }

            showing = true;

            String message = "Version " + version + " (build " + build + ") is available.";
            if (!notes.isEmpty()) message += "\n\n" + notes;
            message += "\n\nYour account data stays in the app and is not cleared by an update.";

            AlertDialog dialog = new AlertDialog.Builder(activity)
                .setTitle(mandatory ? "Update required" : "New update available")
                .setMessage(message)
                .setPositiveButton("Download update", (ignored, which) -> {
                    try {
                        activity.startActivity(
                            new Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl))
                        );
                    } catch (Exception error) {
                        Log.e(TAG, "Unable to open update URL", error);
                    }
                })
                .setNegativeButton(mandatory ? null : "Later", null)
                .setCancelable(!mandatory)
                .create();

            dialog.setOnDismissListener(ignored -> showing = false);
            dialog.show();
        });
    }
}
