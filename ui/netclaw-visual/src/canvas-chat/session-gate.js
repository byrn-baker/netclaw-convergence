// Keep asynchronous replies bound to the visible conversation. Session changes
// wait for user retry after requests finish; requests also refuse during a save.
export function createSessionGate() {
  let requests = 0;
  let changing = false;
  return {
    assertIdle() {
      if (requests || changing) throw new Error('Wait for the current reply or session save to finish.');
    },
    async request(work) {
      if (changing) throw new Error('Wait for the session save to finish.');
      requests += 1;
      try { return await work(); } finally { requests -= 1; }
    },
    async change(work) {
      this.assertIdle();
      changing = true;
      try { return await work(); } finally { changing = false; }
    },
  };
}
