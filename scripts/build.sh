#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
cargo build --locked --release --target wasm32-unknown-unknown
wasm-bindgen --target web --out-dir web/pkg --no-typescript target/wasm32-unknown-unknown/release/swarmkeeper.wasm
cp LICENSE web/LICENSE.txt
printf '\nStatic build ready in web/\nRun: npm run dev\n'
