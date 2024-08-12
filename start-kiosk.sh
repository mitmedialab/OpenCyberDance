#!/usr/bin/env bash

killall -9 "Google Chrome"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --disable-features=CrossSiteDocumentBlockingAlways,CrossSiteDocumentBlockingIfIsolating --noerrdialogs --disable-translate --no-first-run --autoplay-policy=no-user-gesture-required --disable-infobars http://localhost:5173 &

