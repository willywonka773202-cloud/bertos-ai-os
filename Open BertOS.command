#!/bin/zsh

cd "/Users/willlambert/Documents/BertOS" || {
  echo "Could not find /Users/willlambert/Documents/BertOS"
  read "?Press Return to close."
  exit 1
}

npm run bertos:launch -- --port 3000
status=$?

if [ $status -ne 0 ]; then
  echo
  echo "BertOS launcher exited with status $status."
  read "?Press Return to close."
fi
