#!/bin/sh
# Собирает виджет из src/*.js в один файл bm-camera-sim.js
cd "$(dirname "$0")" && cat src/*.js > bm-camera-sim.js && echo "bm-camera-sim.js: $(wc -c < bm-camera-sim.js) байт"
