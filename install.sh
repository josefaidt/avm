#!/bin/bash

URL="https://github.com/josefaidt/avm/releases/latest/download/avm"

echo "Downloading avm..."
curl --fail --location --progress-bar --output /usr/local/bin/avm $URL
chmod +x /usr/local/bin/avm

if ! command -v bun &> /dev/null
then
  echo "bun could not be found and is required to run this script, install? [y/n]"
  read install
  if [ "$install" = "y" ]
  then
    # https://bun.sh/
    curl -fsSL https://bun.sh/install | bash
  else
    echo "bun is required :("
    exit 1
  fi
fi

echo "avm was successfully installed to /usr/local/bin/avm"
echo "Run \`avm --help\` to get started!"