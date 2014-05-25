Set objSWbemServices = GetObject("WinMgmts:Root\Cimv2") 
Set colProcess = objSWbemServices.ExecQuery("Select * From Win32_Process") 
For Each objProcess In colProcess 
    If InStr (objProcess.CommandLine, WScript.ScriptName) <> 0 Then 
        strLine = Mid(objProcess.CommandLine, InStr(objProcess.CommandLine , WScript.ScriptName) + Len(WScript.ScriptName) + 1)
    End If 
Next

strLine = Replace(strLine, """", "")
strLine = Replace(strLine, "'", """")

While Left(strLine, 1) = " "
    strLine = Mid(strLine, 2)
Wend

CreateObject("Wscript.Shell").Run "" & strLine & "", 0, False

