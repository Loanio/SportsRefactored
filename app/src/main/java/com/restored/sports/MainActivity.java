package com.restored.sports;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeAmapPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
