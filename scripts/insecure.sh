#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd "$DIR"/../ >/dev/null;
npm start -- server serverHost=insecure.zeovr.io serverType=insecure hubUrl=none username=username password=password &
sleep infinity;
popd >/dev/null;
