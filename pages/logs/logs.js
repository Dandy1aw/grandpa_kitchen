// logs.js
const util = require('../../utils/util.js')

Page({
  data: {
    logs: []
  },
  onLoad() {
    this.setData({
      logs: (wx.getStorageSync('logs') || []).map(log => {
        return {
          date: util.formatTime(new Date(log)),
          timeStamp: log
        }
      })
    })
  },
  onShareAppMessage() {
    return {
      title: '爷爷的厨房',
      path: '/pages/index/index',
      imageUrl: '/assets/images/grandpa-q-cooking.jpg',
    }
  }
})
