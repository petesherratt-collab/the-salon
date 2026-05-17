@echo off
REM ── The Salon — Long Form Generator ──────────────────────────────────────────
REM Usage: run-longform.bat <persona-id> "subject"
REM
REM Examples:
REM   run-longform.bat machiavelli "Trump and Iran"
REM   run-longform.bat nietzsche "the death of expertise"
REM   run-longform.bat hobbes "social media and the state of nature"
REM   run-longform.bat nietzsche        (persona chooses subject)
REM
REM Available personas:
REM   machiavelli  montaigne    aurelius     nietzsche    hobbes
REM   paine        mill         marx         keynes       hayek
REM   wollstonecraft hume       emerson      suntzu       camus
REM   gracian      woolf        schopenhauer dante        bacon
REM   smith        clausewitz   james        erasmus      suzuki
REM   austen       basho

cd /d "%~dp0"

IF "%~1"=="" (
  echo.
  echo Usage: run-longform.bat ^<persona-id^> ["subject"]
  echo.
  echo Examples:
  echo   run-longform.bat machiavelli "Trump and Iran"
  echo   run-longform.bat nietzsche
  echo.
  pause
  exit /b 1
)

node run-longform.cjs %*

echo.
pause
