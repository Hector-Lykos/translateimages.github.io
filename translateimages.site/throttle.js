const HOUR = 3600*1000;
const maxTimeWindow = 24*HOUR;

const thresholds = {
  feedback: [
    {octets: 0, cost:  40, timeWindow:  1*HOUR, issue: 'Feedback is temporarily unavailable due to heavy usage. Try again in about an hour.'},
    {octets: 3, cost:   4, timeWindow:  1*HOUR, issue: 'Feedback is temporarily unavailable due to heavy usage in your area. Try again in about an hour.'}
  ],
  cloud: [
    {octets: 0, cost:   0, timeWindow:       0, issue: 'This site has been discontinued.'},
    {octets: 0, cost: 450, timeWindow:  2*HOUR, issue: 'Image translation is temporarily unavailable due to usage exceeding available funding. Try again in about 2 hours.'},
    {octets: 3, cost:  45, timeWindow: 24*HOUR, issue: 'Image translation is temporarily unavailable due to heavy usage in your area. Try again another day.'}
  ]
};

const log = {};

function addCost(bucket, user, cost) {
  const ip = user.ip;
  if (user.name === 'test') return;
  if (ip === 'bypass') return;
  const time = Date.now();
  if (!(bucket in log)) log[bucket] = [];
  log[bucket].push({ip, cost, time});
  while (log[bucket][0] && log[bucket][0].time <= time - maxTimeWindow) {
    log[bucket].shift();
  }
}

function getCost(bucket, ip, octets, timeWindow) {
  if (ip === 'bypass') return 0;
  if (!(bucket in log)) return 0;
  const time = Date.now();
  const ipMatch = ip.split('.').slice(0, octets).join('.');
  let sum = 0;
  log[bucket].forEach(entry => {
    if (entry.time > time - timeWindow && entry.ip.split('.').slice(0, octets).join('.') === ipMatch) {
      sum += entry.cost;
    }
  });
  return sum;
}

function overCost(bucket, user, login) {
  const ip = user.ip;
  if (user.name === 'test') return '';
  for (let threshold of thresholds[bucket]) {
    let {octets, cost, timeWindow, issue} = threshold;
    let currentCost = getCost(bucket, ip, octets, timeWindow);
    if (currentCost >= cost) return issue;
  }
  return '';
}

module.exports = {addCost, overCost};
