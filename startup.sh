#!/usr/bin/env bash

. $HOME/.nvm/nvm.sh

cd $(dirname "$0")
$(nvm which 7) start.js
