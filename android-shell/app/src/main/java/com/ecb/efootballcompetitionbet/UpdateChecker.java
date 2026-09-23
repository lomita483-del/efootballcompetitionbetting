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

public final class UpdateChecker {
    private static final String TAG = "ECBUpdateChecker";

    // Prefer GitHub's manifest because it is independent of the Lovable site.
    // Keep two fallbacks so a temporary CDN/network problem does not hide updates.
    private static final String[] MANIFESTS = {
        "https://raw.githubusercontent.com/lomita483-del/efootballcompetitionbetting/main/public/app-release.json",
        "https://cdn.jsdelivr.net/gh/lomita483-del/efootballcompetitionbetting@main/public/app-release.json",
        "https://lslonlinebetting.lovable.app/app-release.json"
    };

    private static final int MAX_ATTEMPTS = 3;
    private static final int CONNECT_TIMEOUT_MS = 8000;
    private static final int READ_TIMEOUT_MS = 8000;

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
                    int bestBuild = -1;
                    int bestMinimumBuild = 0;
                    String bestVersion = "";
                    String bestDownloadUrl = "";
                    String bestNotes = "";
                    boolean bestForceUpdate = false;
                    boolean receivedManifest = false;

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
                            connection.setRequestProperty(
                                "User-Agent",
                                "EFootballCompetitionBet/" + BuildConfig.VERSION_NAME
                            );

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

                            JSONObject manifest = new JSONObject(body.toString());
                            int latestBuild = manifest.optInt("latestBuild", 0);
                            int minimumBuild = manifest.optInt("minimumSupportedBuild", 0);
                            receivedManifest = true;

                            Log.d(TAG, "source=" + manifestUrl
                                + ", installed build=" + BuildConfig.VERSION_CODE
                                + ", latest build=" + latestBuild);

                            if (latestBuild > bestBuild) {
                                bestBuild = latestBuild;
                                bestMinimumBuild = minimumBuild;
                                bestVersion = manifest.optString("latestVersion", "new version");
                                bestDownloadUrl = manifest.optString("downloadUrl", "");
                                bestNotes = formatReleaseNotes(manifest.opt("releaseNotes"));
                                bestForceUpdate = manifest.optBoolean("forceUpdate", false);
                            }
                        } catch (Exception error) {
                            lastError = error;
                            Log.w(TAG, "Update manifest failed from " + manifestUrl
                                + " (attempt " + attempt + ")", error);
                        } finally {
                            if (connection != null) connection.disconnect();
                        }
                    }

                    if (receivedManifest && bestBuild > BuildConfig.VERSION_CODE) {
                        final int updateBuild = bestBuild;
                        final int minimumBuild = bestMinimumBuild;
                        final String version = bestVersion;
                        final String downloadUrl = bestDownloadUrl;
                        final String notes = bestNotes;
                        final boolean mandatory = bestForceUpdate
                            || (minimumBuild > 0 && BuildConfig.VERSION_CODE < minimumBuild);

                        showUpdateDialog(
                            activity, version, updateBuild, notes, downloadUrl, mandatory
                        );
                        return;
                    }

                    if (receivedManifest && bestBuild >= 0) {
                        Log.d(TAG, "No update available. installed build="
                            + BuildConfig.VERSION_CODE + ", highest remote build=" + bestBuild);
                        return;
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
            if (activity.isFinishing() || showing || downloadUrl.isEmpty()) return;

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
