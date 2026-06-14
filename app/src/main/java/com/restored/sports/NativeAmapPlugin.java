package com.restored.sports;

import android.content.Intent;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeAmap")
public class NativeAmapPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        Intent intent = new Intent(getContext(), AmapActivity.class);
        intent.putExtra("title", call.getString("title", "运动地图"));
        intent.putExtra("points", toJson(call.getArray("points")));
        intent.putExtra("polygons", toJson(call.getArray("polygons")));
        getContext().startActivity(intent);

        JSObject result = new JSObject();
        result.put("opened", true);
        call.resolve(result);
    }

    private String toJson(JSArray array) {
        return array == null ? "[]" : array.toString();
    }
}
