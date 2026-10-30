/** Closed semantic boundary for the pinned selected-channel helper. */
import {isDeepStrictEqual} from 'node:util';

export function selectedDelta(before,after,channel){
  if(!before||!after||Array.isArray(before)||Array.isArray(after)||typeof before!=='object'||typeof after!=='object')throw Error('invalid_config');
  const old=structuredClone(before),next=structuredClone(after);
  const selected=next.channels?.[channel];
  if(!selected||typeof selected!=='object'||Array.isArray(selected))throw Error('missing_selected_config');
  for(const cfg of [old,next]){
    if(cfg.channels){delete cfg.channels[channel];if(Object.keys(cfg.channels).length===0)delete cfg.channels;}
  }
  if(!isDeepStrictEqual(old,next))throw Error('unrelated_config_change');
  function access(value,key=''){
    if(Array.isArray(value)){
      if(/allow|users|roles|ships|channels/i.test(key)&&value.some(v=>v==='*'))throw Error('open_access_refused');
      for(const v of value)access(v,key);
    }else if(value&&typeof value==='object'){
      for(const [k,v] of Object.entries(value)){
        if(k==='*'&&/groups|guilds|rooms|channels/i.test(key))throw Error('open_access_refused');
        if((/policy$/i.test(k)&&v==='open')||(/allowAll|allow_all|dangerously|configWrites|autoJoin/i.test(k)&&!['off',false,undefined].includes(v)))throw Error('unsafe_access_refused');
        access(v,k);
      }
    }
  }
  access(selected);
  return structuredClone(selected);
}

export function selectedPlugin(registry,channel,pluginId){
  const entries=(registry.channelSetups||[]).filter(e=>e.pluginId===pluginId&&e.plugin?.id===channel);
  if(entries.length!==1||(registry.channels||[]).length||
      (registry.channelSetups||[]).some(e=>e.pluginId!==pluginId))throw Error('unscoped_plugin_load');
  return entries[0].plugin;
}

/** Exact published artifacts reviewed against the pinned upstream extension catalog. */
export const APPROVED_PACKAGES = Object.freeze({
  "clickclack": {
    "package": "@openclaw/clickclack",
    "version": "2026.7.1",
    "pluginId": "clickclack",
    "nativeId": "clickclack",
    "integrity": "sha512-z6B/jTqrn9j5Oagi9J51knH5AU6llFVXw++DMBxIdtE0Lmj90tuxYYepjSCshmkLItCKjzbdZT8lSB4Onzoucw==",
    "source": "https://registry.npmjs.org/@openclaw/clickclack/-/clickclack-2026.7.1.tgz"
  },
  "discord": {
    "package": "@openclaw/discord",
    "version": "2026.7.1",
    "pluginId": "discord",
    "nativeId": "discord",
    "integrity": "sha512-tZfdC1YA8oVLvc2BK1w0F6rUljS5ugCOp2uWe0vPsbG1fbzVVIO4V32RoqZznGHe5u2R9u4n1aV5Z/qa1m2oFg==",
    "source": "https://registry.npmjs.org/@openclaw/discord/-/discord-2026.7.1.tgz"
  },
  "feishu": {
    "package": "@openclaw/feishu",
    "version": "2026.7.1",
    "pluginId": "feishu",
    "nativeId": "feishu",
    "integrity": "sha512-ZqiRTnlJlmTeWEdWYmjATePC2WOqi2HPq/yeZr2orASWHuYonO38mnU7RU3UvYVQQ3vHAPCPSpMLsKPlCquIPA==",
    "source": "https://registry.npmjs.org/@openclaw/feishu/-/feishu-2026.7.1.tgz"
  },
  "googlechat": {
    "package": "@openclaw/googlechat",
    "version": "2026.7.1",
    "pluginId": "googlechat",
    "nativeId": "googlechat",
    "integrity": "sha512-Dv0xOmcxAThEr6hoK+ioofHNu18hfbIceQrEHX3AHZPpOUiTJvToVpA5eX87NQINewwfSJf0gVhE6kSbSk2Aew==",
    "source": "https://registry.npmjs.org/@openclaw/googlechat/-/googlechat-2026.7.1.tgz"
  },
  "irc": {
    "package": "@openclaw/irc",
    "version": "2026.7.1",
    "pluginId": "irc",
    "nativeId": "irc",
    "integrity": "sha512-ZMLaCcRiyz5l2PezbNPpCZ15GkpoBm813yQJcbIr84j7vfG9Nk5vJiUjdT1IaRih2YsoVhtvPVuHCJPNVl70Ng==",
    "source": "https://registry.npmjs.org/@openclaw/irc/-/irc-2026.7.1.tgz"
  },
  "line": {
    "package": "@openclaw/line",
    "version": "2026.7.1",
    "pluginId": "line",
    "nativeId": "line",
    "integrity": "sha512-hIKwXAHSCX8jkrxXjLFaeKBeeYFSj0wk57pwLx9STSwiiJKZHBGIubG1jVjP8sJOAtug3/pFnvBxLpD3foBtKA==",
    "source": "https://registry.npmjs.org/@openclaw/line/-/line-2026.7.1.tgz"
  },
  "matrix": {
    "package": "@openclaw/matrix",
    "version": "2026.7.1",
    "pluginId": "matrix",
    "nativeId": "matrix",
    "integrity": "sha512-xAEcPHVbj8GwvSLBlbkP8KSqzaD0E98WJVSoZq2B/kYFsHP5zp9TX/6uhF/W2c+vNpjxMgJfKh0Rg3GvpALfkA==",
    "source": "https://registry.npmjs.org/@openclaw/matrix/-/matrix-2026.7.1.tgz"
  },
  "mattermost": {
    "package": "@openclaw/mattermost",
    "version": "2026.7.1",
    "pluginId": "mattermost",
    "nativeId": "mattermost",
    "integrity": "sha512-d7NZ1x1r91JCzVWee5I9NU6MUWE77bNDqeKi7WdvWlKm7vKwR/4QGzJsMYF0kTlJtzapFPIvQptDXx/kU5LvAg==",
    "source": "https://registry.npmjs.org/@openclaw/mattermost/-/mattermost-2026.7.1.tgz"
  },
  "msteams": {
    "package": "@openclaw/msteams",
    "version": "2026.7.1",
    "pluginId": "msteams",
    "nativeId": "msteams",
    "integrity": "sha512-gG/Yk6HZAguHwrmKjsqdONbFz5WNy126PEAXQWNW/TulO1kIifQ6tktM16BQPNLnkmWqLbj+TrrO55Cjas1aFg==",
    "source": "https://registry.npmjs.org/@openclaw/msteams/-/msteams-2026.7.1.tgz"
  },
  "nextcloud-talk": {
    "package": "@openclaw/nextcloud-talk",
    "version": "2026.7.1",
    "pluginId": "nextcloud-talk",
    "nativeId": "nextcloud-talk",
    "integrity": "sha512-a+ret5WnmxLjEBwU26wl5YicOcDSEY3E34yoakQ8OKlDrwH5jIM2UbKUnq4kkoMJtROw/FF3j/GFA7ISlIXQIA==",
    "source": "https://registry.npmjs.org/@openclaw/nextcloud-talk/-/nextcloud-talk-2026.7.1.tgz"
  },
  "nostr": {
    "package": "@openclaw/nostr",
    "version": "2026.7.1",
    "pluginId": "nostr",
    "nativeId": "nostr",
    "integrity": "sha512-s/WG9pqYFAZNLgFtlycYY33vFwBMOqdmC95gc7cn59uJsHfZiw4gyQq7MoKwHPmehgxxcKxiU6T1IBWGOVBnMg==",
    "source": "https://registry.npmjs.org/@openclaw/nostr/-/nostr-2026.7.1.tgz"
  },
  "qqbot": {
    "package": "@openclaw/qqbot",
    "version": "2026.7.1",
    "pluginId": "qqbot",
    "nativeId": "qqbot",
    "integrity": "sha512-h5Ak9UyoIzMl1qs88vYwPBdtXDXfUZmta4Tjo1JVtZjEFF/3zl8JOwAfUv739mgBwJ2D7frHz+yvdLXkSV0lfA==",
    "source": "https://registry.npmjs.org/@openclaw/qqbot/-/qqbot-2026.7.1.tgz"
  },
  "raft": {
    "package": "@openclaw/raft",
    "version": "2026.7.1",
    "pluginId": "raft",
    "nativeId": "raft",
    "integrity": "sha512-esDQP1KKddkB3l0JcNn7KYvAtufKGIQ5edqmvp2DZutMleGxeZ3OCAetDvQtoczkpSzPQoYHY2CMoGbiB3DBiA==",
    "source": "https://registry.npmjs.org/@openclaw/raft/-/raft-2026.7.1.tgz"
  },
  "signal": {
    "package": "@openclaw/signal",
    "version": "2026.7.1",
    "pluginId": "signal",
    "nativeId": "signal",
    "integrity": "sha512-+sx2zNIpcVw4J4AiqtNulzKRId0tBtBclG5RncUlQ45ac4BZDrbQs4C6GkI2KU9Qzbxd+Fxt/ivalmLxcVbbIA==",
    "source": "https://registry.npmjs.org/@openclaw/signal/-/signal-2026.7.1.tgz"
  },
  "slack": {
    "package": "@openclaw/slack",
    "version": "2026.7.1",
    "pluginId": "slack",
    "nativeId": "slack",
    "integrity": "sha512-dwVGEVCmoTQrOIeZaSCIOPg8pT7hB883QQEXdp9EZUDzTGuvSc+KxH2iERSOV/59hROQctYdcobGn/vdB1H4XA==",
    "source": "https://registry.npmjs.org/@openclaw/slack/-/slack-2026.7.1.tgz"
  },
  "sms": {
    "package": "@openclaw/sms",
    "version": "2026.7.1",
    "pluginId": "sms",
    "nativeId": "sms",
    "integrity": "sha512-G2oxpX6O/UfdhJhNclznqBZdWLyY8Ysg2gZZs+jiIRBGfymV+AGiD8tL+4JGAH4nGSNLBRMjDzzmh8hiEEa/QA==",
    "source": "https://registry.npmjs.org/@openclaw/sms/-/sms-2026.7.1.tgz"
  },
  "synology-chat": {
    "package": "@openclaw/synology-chat",
    "version": "2026.7.1",
    "pluginId": "synology-chat",
    "nativeId": "synology-chat",
    "integrity": "sha512-TfFGi4cWKCR0ptXGNKmTorCJ8Jh0EoMs7Sek1Iz5a4eEgUuT5bI3Ae+vZBYDhNQ4XLgGnvzISFEP7p7AKsCIRQ==",
    "source": "https://registry.npmjs.org/@openclaw/synology-chat/-/synology-chat-2026.7.1.tgz"
  },
  "tlon": {
    "package": "@openclaw/tlon",
    "version": "2026.7.1",
    "pluginId": "tlon",
    "nativeId": "tlon",
    "integrity": "sha512-EFTQAgagLJ/5a7/C6mBEwVBPA01zQa0PtGSvgL6HFLY3N5I/xEp1Vw94GxRff9mPQjDyU8t1v2FfKr15QrIuVg==",
    "source": "https://registry.npmjs.org/@openclaw/tlon/-/tlon-2026.7.1.tgz"
  },
  "twitch": {
    "package": "@openclaw/twitch",
    "version": "2026.7.1",
    "pluginId": "twitch",
    "nativeId": "twitch",
    "integrity": "sha512-avPL8XslyRrwHGIt+P+EQidCuAsxofJa/mWWQjhgQ+bG5MJIeuo0HAwaUU5NfwYuszL2K0xIS/k8GPnr006j0g==",
    "source": "https://registry.npmjs.org/@openclaw/twitch/-/twitch-2026.7.1.tgz"
  },
  "whatsapp": {
    "package": "@openclaw/whatsapp",
    "version": "2026.7.1",
    "pluginId": "whatsapp",
    "nativeId": "whatsapp",
    "integrity": "sha512-wLY/Omc5fleRpl2lKGN8sxt/8hYfHGwLRezmWsk8oCbea5pRKUPE6ZX+wJO1O52NOJkAGCuiXvS7x0qIeKxXbQ==",
    "source": "https://registry.npmjs.org/@openclaw/whatsapp/-/whatsapp-2026.7.1.tgz"
  },
  "zalo": {
    "package": "@openclaw/zalo",
    "version": "2026.7.1",
    "pluginId": "zalo",
    "nativeId": "zalo",
    "integrity": "sha512-SQFbysP8K6PbhZ2V01LxCVlyPTlSie2/YR6pIIB0TzWkuGF4hhMYRtKlxdHTkD9HTOipqu5Kt4JaIfiT1mq9sA==",
    "source": "https://registry.npmjs.org/@openclaw/zalo/-/zalo-2026.7.1.tgz"
  },
  "zalouser": {
    "package": "@openclaw/zalouser",
    "version": "2026.7.1",
    "pluginId": "zalouser",
    "nativeId": "zalouser",
    "integrity": "sha512-klg0BOOTDv4xUykgA/pTZDsRrI9dzagq23OlPupCLrFijDOebPxGYaYdWDSPy4zBJAWjjnSrgyCB+5OuCMvZGw==",
    "source": "https://registry.npmjs.org/@openclaw/zalouser/-/zalouser-2026.7.1.tgz"
  },
  "wecom": {
    "package": "@wecom/wecom-openclaw-plugin",
    "version": "2026.5.7",
    "pluginId": "wecom-openclaw-plugin",
    "nativeId": "wecom",
    "integrity": "sha512-TCkP9as00WfEhgFWG8YL/rcmaWGIshAki2HQh83nTRccGfVBCoGjrEboTTqq3yDmK9koWTV11zi8u8A4dNtvug==",
    "source": "https://registry.npmjs.org/@wecom/wecom-openclaw-plugin/-/wecom-openclaw-plugin-2026.5.7.tgz"
  },
  "wechat": {
    "package": "@tencent-weixin/openclaw-weixin",
    "version": "2.4.6",
    "pluginId": "openclaw-weixin",
    "nativeId": "openclaw-weixin",
    "integrity": "sha512-qw9k3PLTiMWGNjjsknHgcTManH1w4j+Ji1ArWIaYLKCq3aFRsVwcqnPi127bvOoVMJGW4dbyJ8NECEMgoO+iRw==",
    "source": "https://registry.npmjs.org/@tencent-weixin/openclaw-weixin/-/openclaw-weixin-2.4.6.tgz"
  },
  "zaloclawbot": {
    "package": "@zalo-platforms/openclaw-zaloclawbot",
    "version": "0.1.4",
    "pluginId": "openclaw-zaloclawbot",
    "nativeId": "openclaw-zaloclawbot",
    "integrity": "sha512-5IxZriHJYACLLGqkCPPsTP9tas62kXEOFqTFAFMdunAM3SPhIJwVFRp0WvoP/m7L2PX85weD0g8LOtxM93VDYg==",
    "source": "https://registry.npmjs.org/@zalo-platforms/openclaw-zaloclawbot/-/openclaw-zaloclawbot-0.1.4.tgz"
  }
});
