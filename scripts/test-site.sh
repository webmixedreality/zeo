#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../

./index.js install

./index.js site \
  port=8080 secure=true \
  homeUrl='https://127.0.0.1:8081' \
  cryptoDirectory='crypto-test' cryptoDirectorySrc='defaults/crypto' &
./index.js home \
  port=8081 secure=true \
  siteUrl='https://127.0.0.1:8080' \
  cryptoDirectory='crypto-test' cryptoDirectorySrc='defaults/crypto' &
./index.js hub \
  port=8000 secure=true \
  # hubUrl='https://hub.zeovr.io:8000' \
  cryptoDirectory='crypto-test' cryptoDirectorySrc='defaults/crypto' &

sleep infinity;

popd;
