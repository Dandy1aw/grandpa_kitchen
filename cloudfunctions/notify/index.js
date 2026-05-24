const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const TEMPLATE_ID = 'ur3RRVfn4M-jMsVTP8wtEbzWzpzsW4xDpnKOcO8_g40';

exports.main = async (event) => {
  const { diner, dishText, taste, note } = event;

  // 查找爷爷的 openid
  const usersRes = await db.collection('users').where({ role: 'grandpa' }).limit(1).get();
  if (!usersRes.data || usersRes.data.length === 0) {
    return { success: false, reason: 'grandpa not found' };
  }

  const grandpaOpenid = usersRes.data[0]._openid;
  const remarkText = [taste, note].filter(Boolean).join('，').slice(0, 20) || '无备注';

  try {
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    await cloud.openapi.subscribeMessage.send({
      touser: grandpaOpenid,
      templateId: TEMPLATE_ID,
      page: 'pages/admin/admin',
      data: {
        thing1: { value: dishText.slice(0, 20) },
        name2: { value: diner.slice(0, 10) },
        date3: { value: timeStr },
      },
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
