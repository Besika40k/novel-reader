package io.github.besika40k.novelreader;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // With the default behaviour, hiding the bars for full-screen reading keeps the status bar
        // on screen for half a second and then fades it out over another second, long after the
        // reader's own bars have gone. Transient bars slide away at once instead, in about a third
        // of a second, and a swipe from the edge only shows them for a moment.
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
    }
}
