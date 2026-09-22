package com.ecb.efootballcompetitionbet;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public final class UpdateChecker {
    private static final String MANIFEST =
        "https://raw.githubusercontent.com/lomita483-del/efootballcompetitionbet/main/public/app-release.json";
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static boolean dialogShowing = false;

    private UpdateChecker() {}

    public static void check(Activity activity, boolean forceNetwork) {
        if (activity == null || activity.isFinishing()) return;

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
                try (InputStream in = conn.getInputStream();
                     BufferedReader reader = new BufferedReader(new InputStreamReader(in))) {
                    String line;
                    while ((line = reader.readLine()) != null) body.append(line);
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
            .setPositiveButton("Download update", (d, which) -> {
                if (!downloadUrl.isEmpty()) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl));
                        activity.startActivity(intent);
                    } catch (Exception ignored) {}
                }
            })
            .setCancelable(!mandatory)
            .create();

        if (!mandatory) {
            dialog.setOnDismissListener(d -> dialogShowing = false);
        } else {
            dialog.setOnDismissListener(d -> {
                dialogShowing = false;
                MAIN.postDelayed(() -> check(activity, true), 1500);
            });
        }

        dialog.setCanceledOnTouchOutside(!mandatory);
        dialog.show();
    }
}
