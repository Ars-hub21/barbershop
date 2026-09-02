const TimeUtils = {
  timeToMinutes: function(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  },

  minutesToTime: function(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  },

  formatDuration: function(minutes) {
    if (minutes < 60) return `${minutes} мин`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
  },

  calculateEndTime: function(start, duration) {
    return this.minutesToTime(this.timeToMinutes(start) + duration);
  },

  generateAllSlots: function() {
    const slots = [];
    for (let h = 10; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return slots;
  },

  getToday: function() {
    return new Date().toISOString().split('T')[0];
  },

  isPast: function(date) {
    return date < this.getToday();
  }
};