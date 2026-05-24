// app.js
App({
  onLaunch() {
    wx.cloud.init({
      env: 'cloud1-d8ggtlgfhe8c6831f',
      traceUser: true,
    });
  },
})
