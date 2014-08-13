#!/bin/bash

FSM_PROFILE=`find $HOME/.freespeechme-standalone/ -name *.default`

echo Your FreeSpeechMe profile directory was detected as $FSM_PROFILE

echo Dumping FreeSpeechMe CA certificate...

certutil -L -d "$FSM_PROFILE" -n "Convergence" -a > Convergence.crt
openssl x509 -in Convergence.crt -out Convergence.pem -text

echo CA certificate dumped.

echo Importing CA certificate into system...

sudo cp Convergence.pem /etc/pki/ca-trust/source/anchors/
sudo update-ca-trust

echo Finished!