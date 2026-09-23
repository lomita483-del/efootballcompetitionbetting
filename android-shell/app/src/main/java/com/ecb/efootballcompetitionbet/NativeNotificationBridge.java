package com.ecb.efootballcompetitionbet;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.webkit.JavascriptInterface;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

public final class NativeNotificationBridge {
    private static final String CHANNEL_ID = "ecb_realtime";
    private final Context context;

    public NativeNotificationBridge(Context context) {
        this.context = context.getApplicationContext();
    }

    @JavascriptInterface
    public void notifyNotification(String json) {
        try {
            JSONObject item = new JSONObject(json == null ? "{}" : json);
            String title = item.optString("title", "E-Football Competition Bet").trim();
            String body = item.optString("body", "").trim();
            if (title.isEmpty()) title = "E-Football Competition Bet";

            Intent intent = new Intent(context, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pending = PendingIntent.getActivity(
                context,
                (int) (System.currentTimeMillis() & 0x7fffffff),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT |
                    (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(body.isEmpty() ? new NotificationCompat.BigTextStyle().bigText(title)
                    : new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(pending)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .build();

            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), notification);
            }
        } catch (Exception ignored) {
            // A notification failure must never break the web application.
        }
    }
}
