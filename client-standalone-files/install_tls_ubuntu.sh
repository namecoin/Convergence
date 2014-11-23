#!/bin/bash

FSM_PROFILE=`find $HOME/.freespeechme-standalone/ -name *.default`

echo Your FreeSpeechMe profile directory was detected as $FSM_PROFILE

echo Dumping FreeSpeechMe CA certificate...

certutil -L -d "$FSM_PROFILE" -n "Convergence" -a > Convergence.crt

echo CA certificate dumped.

echo Importing CA certificate into system...

sudo cp Convergence.crt /usr/local/share/ca-certificates/Convergence.crt
sudo update-ca-certificates

echo Importing certificate into NSS...

certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n "Convergence" -i "Convergence.crt"

echo Finished!