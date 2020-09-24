#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

yarn run compile

npx mocha --exit --recursive test/unit -t 5000

exit 0
