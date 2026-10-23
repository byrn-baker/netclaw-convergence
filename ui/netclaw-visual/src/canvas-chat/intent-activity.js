// Report observable workflow state, not imagined model reasoning or progress.
export function intentActivity({ phase = 'idle', error = '', message, connected = false, executionEnabled = false } = {}) {
  if (error) return { title: 'Stopped — action needed', detail: error, tone: 'error' };
  if (phase === 'request') return {
    title: 'Waiting for AI response', busy: true,
    detail: 'The request is in progress. Detailed model progress is not available. No configuration has been sent by this intent request.',
  };
  if (phase === 'capture') return {
    title: 'Collecting read-only terminal output', busy: true,
    detail: 'Show/diagnostic commands were sent. Configuration has not been sent. Waiting for output before explaining the results.',
  };
  if (phase === 'summary') return {
    title: 'Waiting for AI to explain the captured output', busy: true,
    detail: 'This step produces an explanation only. It will not automatically continue into configuration.',
  };
  if (executionEnabled) return {
    title: message ? 'Ready for your next request' : 'Ready to act on your intent',
    detail: 'State the outcome you want. NetClaw will discover, act and verify through its tools, subject to existing permissions and change controls. Explain output only explains; it does not execute.',
  };
  if (message?.execution?.status === 'reviewed-sent') return {
    title: 'Reviewed configuration sent — verify in Terminal',
    detail: 'The CLI was sent to the terminal connection. Successful application has not been verified. No further steps are running.',
  };
  if (message?.proposal?.commands?.length && message.proposal.risk !== 'read-only') return {
    title: 'Waiting for your configuration review', tone: 'review',
    detail: `${connected ? '' : 'Connect to the device first. '}Review the proposed CLI, check "I reviewed the exact CLI", then choose "Send configuration". The AI is not still thinking; no changes have been sent.`,
  };
  if (message?.execution?.status === 'not-connected') return {
    title: 'Stopped — terminal connection required', tone: 'review',
    detail: 'No commands were sent. Connect to the device and submit the request again; waiting alone will not run it.',
  };
  if (message?.terminalOutput) return {
    title: 'Read-only check finished — stopped here',
    detail: 'Results are ready. No configuration was sent, and no further planning is running. To continue, ask for a configuration proposal using these results.',
  };
  if (message?.execution?.status === 'sent') return {
    title: 'Read-only commands previously sent',
    detail: 'No active collection or AI request is running in this window. Review the transcript or submit a new request. No configuration was sent.',
  };
  return {
    title: message ? 'Response ready — waiting for you' : 'Ready for an intent request',
    detail: 'Read-only commands can run automatically. Configuration requires a CLI proposal and your explicit review. Waiting alone does not start another step.',
  };
}
