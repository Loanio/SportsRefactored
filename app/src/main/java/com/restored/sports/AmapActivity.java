package com.restored.sports;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.FrameLayout;
import android.widget.TextView;

import com.amap.api.maps.AMap;
import com.amap.api.maps.CameraUpdateFactory;
import com.amap.api.maps.MapView;
import com.amap.api.maps.MapsInitializer;
import com.amap.api.maps.model.BitmapDescriptorFactory;
import com.amap.api.maps.model.LatLng;
import com.amap.api.maps.model.LatLngBounds;
import com.amap.api.maps.model.MarkerOptions;
import com.amap.api.maps.model.PolygonOptions;
import com.amap.api.maps.model.PolylineOptions;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class AmapActivity extends Activity {
    private MapView mapView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        MapsInitializer.updatePrivacyShow(this, true, true);
        MapsInitializer.updatePrivacyAgree(this, true);

        FrameLayout root = new FrameLayout(this);
        mapView = new MapView(this);
        mapView.onCreate(savedInstanceState);
        root.addView(mapView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        TextView title = new TextView(this);
        title.setText(getIntent().getStringExtra("title"));
        title.setTextColor(Color.WHITE);
        title.setTextSize(18);
        title.setGravity(Gravity.CENTER);
        title.setBackgroundColor(Color.rgb(26, 135, 95));
        FrameLayout.LayoutParams titleParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            dp(56)
        );
        titleParams.gravity = Gravity.TOP;
        root.addView(title, titleParams);
        setContentView(root);

        drawMap();
    }

    private void drawMap() {
        AMap map = mapView.getMap();
        map.getUiSettings().setZoomControlsEnabled(false);
        map.getUiSettings().setMyLocationButtonEnabled(true);
        map.setMyLocationEnabled(true);

        List<LatLng> points = parsePoints(getIntent().getStringExtra("points"));
        List<LatLng> polygons = parsePoints(getIntent().getStringExtra("polygons"));
        List<LatLng> boundsPoints = new ArrayList<>();
        boundsPoints.addAll(points);
        boundsPoints.addAll(polygons);

        if (polygons.size() >= 3) {
            map.addPolygon(new PolygonOptions()
                .addAll(polygons)
                .strokeColor(Color.argb(230, 255, 255, 255))
                .fillColor(Color.argb(58, 26, 135, 95))
                .strokeWidth(6));
        }

        if (points.size() >= 2) {
            map.addPolyline(new PolylineOptions()
                .addAll(points)
                .color(Color.rgb(255, 193, 7))
                .width(12));
        }

        if (!points.isEmpty()) {
            map.addMarker(new MarkerOptions()
                .position(points.get(points.size() - 1))
                .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_YELLOW)));
        }

        if (!boundsPoints.isEmpty()) {
            LatLngBounds.Builder builder = LatLngBounds.builder();
            for (LatLng item : boundsPoints) builder.include(item);
            map.moveCamera(CameraUpdateFactory.newLatLngBounds(builder.build(), dp(80)));
        }
    }

    private List<LatLng> parsePoints(String json) {
        List<LatLng> points = new ArrayList<>();
        if (json == null || json.length() == 0) return points;
        try {
            JSONArray array = new JSONArray(json);
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.optJSONObject(i);
                if (obj == null) continue;
                double lng = obj.optDouble("longitude", obj.optDouble("lng", Double.NaN));
                double lat = obj.optDouble("latitude", obj.optDouble("lat", Double.NaN));
                if (!Double.isNaN(lng) && !Double.isNaN(lat)) points.add(new LatLng(lat, lng));
            }
        } catch (Exception ignored) {
        }
        return points;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onResume() {
        super.onResume();
        mapView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        mapView.onPause();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        mapView.onDestroy();
    }

    @Override
    public void onLowMemory() {
        super.onLowMemory();
        mapView.onLowMemory();
    }
}
