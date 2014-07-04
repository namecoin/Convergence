#!/bin/bash

certutil -L -d ./ -n "Convergence" -a > Convergence.crt
sudo cp Convergence.crt /usr/local/share/ca-certificates/Convergence.crt
sudo update-ca-certificates
certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n "Convergence" -i "Convergence.crt"

