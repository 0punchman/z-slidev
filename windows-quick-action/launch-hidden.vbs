' launch-hidden.vbs
' Start a PowerShell script with WindowStyle Hidden and do not wait.
' Args: <ps1-path> [markdown-path]
Option Explicit
Dim sh, ps1, md, cmd
If WScript.Arguments.Count < 1 Then
  WScript.Quit 1
End If
ps1 = WScript.Arguments(0)
md = ""
If WScript.Arguments.Count >= 2 Then
  md = WScript.Arguments(1)
End If
Set sh = CreateObject("WScript.Shell")
If Len(md) > 0 Then
  cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """ """ & md & """"
Else
  cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """"
End If
' 0 = hidden window, False = do not wait
sh.Run cmd, 0, False
