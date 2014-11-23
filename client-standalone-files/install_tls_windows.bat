@echo off

echo MAKE SURE YOU ARE RUNNING THIS AS AN ADMINISTRATOR!  OTHERWISE IT WILL NOT WORK!

FOR /D %%G in ("%USERPROFILE%\Application Data\FreeSpeechMe-Standalone\Profiles\*.default") DO Set FSM_PROFILE=%%G

echo Your FreeSpeechMe profile directory was detected as %FSM_PROFILE%

echo Dumping FreeSpeechMe CA certificate...

win-nss\certutil -L -d "%FSM_PROFILE%" -n "Convergence" -a > Convergence.crt

echo CA certificate dumped.

echo Importing CA certificate into system...

certutil -f -addstore -enterprise root Convergence.crt

echo Finished!
