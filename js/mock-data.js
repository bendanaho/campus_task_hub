const CATEGORY_MAP = {
    'errand': '跑腿代办',
    'life-service': '生活服务',
    'skill-help': '技能帮助',
    'study-help': '学习互助',
    'material-share': '资料共享',
    'item-trade': '物品交易',
    'teamwork': '组队协作',
    'other': '其他'
};

const CATEGORY_OPTIONS = [
    { value: 'errand', label: '跑腿代办（快递、外卖、代买）' },
    { value: 'life-service', label: '生活服务（搬运、打印、帮忙）' },
    { value: 'skill-help', label: '技能帮助（维修、设计、编程）' },
    { value: 'study-help', label: '学习互助（答疑、辅导、陪学）' },
    { value: 'material-share', label: '资料共享（课件、笔记、资料）' },
    { value: 'item-trade', label: '物品交易（二手、闲置、交换）' },
    { value: 'teamwork', label: '组队协作（搭子、组队、合作）' },
    { value: 'other', label: '其他（其他类型任务）' }
];

function createInitialData() {
    const now = new Date();
    const dayAgo = function(n) { return new Date(now.getTime() - n * 86400000).toISOString(); };
    const hourAgo = function(n) { return new Date(now.getTime() - n * 3600000).toISOString(); };

    var users = [
        {
            id: 'u1', username: '张三', phone: '13800138001', email: 'zhangsan@example.com', password: '123456',
            avatar: 'https://picsum.photos/seed/avatar1/200/200',
            creditScore: 4.8, authStatus: 'verified',
            realName: '张小明', studentId: '2021010001',
            college: '计算机学院', className: '软件工程2101',
            bio: '乐于助人，常在线，愿意参与校园互助任务。'
        },
        {
            id: 'u2', username: '李四', phone: '13800138002', email: 'lisi@example.com', password: '123456',
            avatar: 'https://picsum.photos/seed/avatar2/200/200',
            creditScore: 4.2, authStatus: 'verified',
            realName: '李华', studentId: '2021020002',
            college: '经济管理学院', className: '金融学2102',
            bio: '喜欢帮助别人，课余时间比较多。'
        },
        {
            id: 'u3', username: '王同学', phone: '13800138003', email: 'wang@example.com', password: '123456',
            avatar: '', creditScore: 3.5, authStatus: 'unverified',
            realName: '', studentId: '', college: '', className: '',
            bio: '新用户，正在探索平台功能。'
        },
        {
            id: 'u4', username: '陈同学', phone: '13800138004', email: 'chen@example.com', password: '123456',
            avatar: 'https://picsum.photos/seed/avatar4/200/200',
            creditScore: 2.8, authStatus: 'verified',
            realName: '陈志强', studentId: '2021030004',
            college: '机械工程学院', className: '机械设计2101',
            bio: '做事认真负责，但有时回复较慢。'
        },
        {
            id: 'u5', username: '赵同学', phone: '13800138005', email: 'zhao@example.com', password: '123456',
            avatar: 'https://picsum.photos/seed/avatar5/200/200',
            creditScore: 4.9, authStatus: 'verified',
            realName: '赵雨薇', studentId: '2021040005',
            college: '设计学院', className: '视觉传达2103',
            bio: '设计专业学生，擅长海报和PPT制作。'
        },
        {
            id: 'u6', username: '刘同学', phone: '13800138006', email: 'liu@example.com', password: '123456',
            avatar: '', creditScore: 3.9, authStatus: 'unverified',
            realName: '', studentId: '', college: '', className: '',
            bio: '数学系学生，乐于助人。'
        },
        {
            id: 'u7', username: '孙同学', phone: '13800138007', email: 'sun@example.com', password: '123456',
            avatar: 'https://picsum.photos/seed/avatar7/200/200',
            creditScore: 4.6, authStatus: 'verified',
            realName: '孙文博', studentId: '2021050007',
            college: '外国语学院', className: '英语2101',
            bio: '英语口语流利，喜欢交朋友。'
        },
        {
            id: 'u8', username: '周同学', phone: '13800138008', email: 'zhou@example.com', password: '123456',
            avatar: '', creditScore: 2.5, authStatus: 'unverified',
            realName: '', studentId: '', college: '', className: '',
            bio: '校内打印店兼职，可以帮忙打印资料。'
        }
    ];

    var tasks = [
        {
            id: 't1', title: '帮忙取快递', type: 'demand', category: 'errand',
            description: '从学校菜鸟驿站取一个中等大小快递，送到 3 号宿舍楼下即可。',
            publisherId: 'u1', publisherName: '张三', publisherCredit: 4.8,
            reward: '5元', rewardValue: 5,
            deadline: dayAgo(-1), publishTime: hourAgo(26),
            status: 'pending', contact: '站内联系',
            images: ['https://picsum.photos/seed/task1a/300/200']
        },
        {
            id: 't2', title: '代拿外卖', type: 'demand', category: 'errand',
            description: '帮忙从东门外卖柜取餐，送到教学楼 A 区门口。',
            publisherId: 'u2', publisherName: '李四', publisherCredit: 4.2,
            reward: '4元', rewardValue: 4,
            deadline: dayAgo(-1), publishTime: hourAgo(30),
            status: 'pending', contact: '站内联系', images: []
        },
        {
            id: 't3', title: '宿舍搬运行李', type: 'demand', category: 'life-service',
            description: '需要帮忙把两个行李箱从 1 号宿舍楼搬到 8 号宿舍楼，有电梯。',
            publisherId: 'u4', publisherName: '陈同学', publisherCredit: 2.8,
            reward: '15元', rewardValue: 15,
            deadline: dayAgo(-2), publishTime: hourAgo(48),
            status: 'pending', contact: '微信联系',
            images: ['https://picsum.photos/seed/task3a/300/200']
        },
        {
            id: 't4', title: '帮修电脑无法联网问题', type: 'demand', category: 'skill-help',
            description: '笔记本电脑连不上校园网，想请懂电脑的同学帮忙排查一下问题。',
            publisherId: 'u3', publisherName: '王同学', publisherCredit: 3.5,
            reward: '20元', rewardValue: 20,
            deadline: dayAgo(-1), publishTime: hourAgo(12),
            status: 'pending', contact: '电话联系', images: []
        },
        {
            id: 't5', title: '社团海报设计', type: 'demand', category: 'skill-help',
            description: '需要一张活动宣传海报，风格活泼简洁，今晚可先出草稿更好。',
            publisherId: 'u5', publisherName: '赵同学', publisherCredit: 4.9,
            reward: '30元', rewardValue: 30,
            deadline: dayAgo(-3), publishTime: hourAgo(36),
            status: 'pending', contact: 'QQ联系',
            images: ['https://picsum.photos/seed/task5a/300/200', 'https://picsum.photos/seed/task5b/300/200']
        },
        {
            id: 't6', title: '图书馆占座', type: 'demand', category: 'study-help',
            description: '明天早上 8 点前在图书馆三楼帮忙占一个座位，靠窗优先。',
            publisherId: 'u6', publisherName: '刘同学', publisherCredit: 3.9,
            reward: '3元', rewardValue: 3,
            deadline: dayAgo(-1), publishTime: hourAgo(44),
            status: 'pending', contact: '站内联系', images: []
        },
        {
            id: 't7', title: '高数题目答疑', type: 'demand', category: 'study-help',
            description: '想请一位同学帮忙讲解几道高等数学极限题，线下 30 分钟左右。',
            publisherId: 'u7', publisherName: '孙同学', publisherCredit: 4.6,
            reward: '10元', rewardValue: 10,
            deadline: dayAgo(-2), publishTime: hourAgo(15),
            status: 'pending', contact: '微信联系', images: []
        },
        {
            id: 't8', title: '借实验课报告模板', type: 'demand', category: 'material-share',
            description: '想找一份上学期实验课报告模板作参考，有偿求助。',
            publisherId: 'u8', publisherName: '周同学', publisherCredit: 2.5,
            reward: '2元', rewardValue: 2,
            deadline: dayAgo(-1), publishTime: hourAgo(42),
            status: 'pending', contact: '站内联系', images: []
        },
        {
            id: 't9', title: '求数据库课程笔记', type: 'demand', category: 'material-share',
            description: '想购买一份数据库原理的期中复习笔记，最好是本学期老师上课版本。',
            publisherId: 'u1', publisherName: '张三', publisherCredit: 4.8,
            reward: '5元', rewardValue: 5,
            deadline: dayAgo(-3), publishTime: hourAgo(27),
            status: 'pending', contact: 'QQ联系',
            images: ['https://picsum.photos/seed/task9a/300/200']
        },
        {
            id: 't10', title: '转让二手台灯', type: 'demand', category: 'item-trade',
            description: '毕业清理闲置，转让一盏九成新护眼台灯，可在宿舍区当面交易。',
            publisherId: 'u2', publisherName: '李四', publisherCredit: 4.2,
            reward: '25元', rewardValue: 25,
            deadline: dayAgo(-5), publishTime: hourAgo(29),
            status: 'pending', contact: '电话联系',
            images: ['https://picsum.photos/seed/task10a/300/200', 'https://picsum.photos/seed/task10b/300/200', 'https://picsum.photos/seed/task10c/300/200']
        },
        {
            id: 't11', title: '求购二手自行车', type: 'demand', category: 'item-trade',
            description: '想收一辆能正常骑行的二手自行车，预算 150 元以内，校内面交。',
            publisherId: 'u4', publisherName: '陈同学', publisherCredit: 2.8,
            reward: '面议', rewardValue: 0,
            deadline: dayAgo(-7), publishTime: hourAgo(72),
            status: 'pending', contact: '微信联系', images: []
        },
        {
            id: 't12', title: '羽毛球搭子招募', type: 'demand', category: 'teamwork',
            description: '想找一位每周二、周四晚上一起打羽毛球的搭子，水平不限。',
            publisherId: 'u5', publisherName: '赵同学', publisherCredit: 4.9,
            reward: '无', rewardValue: 0,
            deadline: dayAgo(-30), publishTime: hourAgo(35),
            status: 'pending', contact: '站内联系', images: []
        },
        {
            id: 't13', title: '数学建模比赛组队', type: 'demand', category: 'teamwork',
            description: '准备参加校级数学建模比赛，想找会写论文或会编程的同学组队。',
            publisherId: 'u3', publisherName: '王同学', publisherCredit: 3.5,
            reward: '无', rewardValue: 0,
            deadline: dayAgo(-14), publishTime: hourAgo(14),
            status: 'pending', contact: 'QQ联系', images: []
        },
        {
            id: 't14', title: '失物招领信息代发布', type: 'demand', category: 'other',
            description: '帮忙把一则失物招领信息转发到年级群，完成后截图即可。',
            publisherId: 'u6', publisherName: '刘同学', publisherCredit: 3.9,
            reward: '1元', rewardValue: 1,
            deadline: dayAgo(-1), publishTime: hourAgo(18),
            status: 'pending', contact: '站内联系', images: []
        },
        {
            id: 't15', title: '可长期代取快递', type: 'service', category: 'errand',
            description: '工作日傍晚可帮忙代取快递，覆盖西区宿舍，响应较快，支持提前联系。',
            publisherId: 'u7', publisherName: '孙同学', publisherCredit: 4.6,
            reward: '3-5元/单', rewardValue: 4,
            deadline: dayAgo(-30), publishTime: hourAgo(16),
            status: 'available', contact: '微信联系',
            images: ['https://picsum.photos/seed/task15a/300/200']
        },
        {
            id: 't16', title: '可代买早餐和日用品', type: 'service', category: 'errand',
            description: '早上可顺路代买早餐、矿泉水、纸巾等日用品，南区宿舍优先。',
            publisherId: 'u8', publisherName: '周同学', publisherCredit: 2.5,
            reward: '2-6元/次', rewardValue: 4,
            deadline: dayAgo(-30), publishTime: hourAgo(7),
            status: 'available', contact: '电话联系', images: []
        },
        {
            id: 't17', title: '提供 PPT 美化与排版服务', type: 'service', category: 'skill-help',
            description: '可帮忙优化课程汇报 PPT、社团展示 PPT，支持简约风、学术风、活泼风。',
            publisherId: 'u1', publisherName: '张三', publisherCredit: 4.8,
            reward: '20元起', rewardValue: 20,
            deadline: dayAgo(-30), publishTime: hourAgo(21),
            status: 'available', contact: 'QQ联系',
            images: ['https://picsum.photos/seed/task17a/300/200']
        },
        {
            id: 't18', title: '提供基础电脑故障排查', type: 'service', category: 'skill-help',
            description: '可协助处理系统卡顿、软件安装、打印机连接、校园网基础问题等。',
            publisherId: 'u2', publisherName: '李四', publisherCredit: 4.2,
            reward: '15元起', rewardValue: 15,
            deadline: dayAgo(-30), publishTime: hourAgo(13),
            status: 'available', contact: '微信联系', images: []
        },
        {
            id: 't19', title: '高数一对一答疑辅导', type: 'service', category: 'study-help',
            description: '可辅导极限、导数、积分等基础内容，适合期中前突击复习。',
            publisherId: 'u5', publisherName: '赵同学', publisherCredit: 4.9,
            reward: '25元/小时', rewardValue: 25,
            deadline: dayAgo(-30), publishTime: hourAgo(18),
            status: 'available', contact: '站内联系', images: []
        },
        {
            id: 't20', title: '英语口语陪练', type: 'service', category: 'study-help',
            description: '可陪练四六级口语、自我介绍、日常对话，适合基础薄弱同学。',
            publisherId: 'u4', publisherName: '陈同学', publisherCredit: 2.8,
            reward: '18元/30分钟', rewardValue: 18,
            deadline: dayAgo(-30), publishTime: hourAgo(20),
            status: 'available', contact: '电话联系',
            images: ['https://picsum.photos/seed/task20a/300/200', 'https://picsum.photos/seed/task20b/300/200']
        },
        {
            id: 't21', title: '出售整理版期中复习资料', type: 'service', category: 'material-share',
            description: '提供数据库、数据结构、大学物理等课程的重点整理资料，可发电子版。',
            publisherId: 'u7', publisherName: '孙同学', publisherCredit: 4.6,
            reward: '8元/份', rewardValue: 8,
            deadline: dayAgo(-30), publishTime: hourAgo(17),
            status: 'available', contact: 'QQ联系', images: []
        },
        {
            id: 't22', title: '帮忙打印装订资料', type: 'service', category: 'life-service',
            description: '可代打印课程作业、论文、简历等，支持黑白和彩印，晚间也可联系。',
            publisherId: 'u8', publisherName: '周同学', publisherCredit: 2.5,
            reward: '按页计费', rewardValue: 0,
            deadline: dayAgo(-30), publishTime: hourAgo(10),
            status: 'available', contact: '微信联系',
            images: ['https://picsum.photos/seed/task22a/300/200']
        }
    ];

    tasks.sort(function() { return Math.random() - 0.5; });

    var messages = [
        {
            id: 'm1', chatId: 'c1', senderId: 'u2', senderName: '李四',
            receiverId: 'u1', content: '好的，我 10 分钟后到宿舍楼下。',
            time: hourAgo(2), taskId: 't1', taskTitle: '帮忙取快递',
            withdrawn: false
        },
        {
            id: 'm2', chatId: 'c1', senderId: 'u1', senderName: '张三',
            receiverId: 'u2', content: '好的，我在楼下等你，穿蓝色外套。',
            time: hourAgo(1.8), taskId: 't1', taskTitle: '帮忙取快递',
            withdrawn: false
        },
        {
            id: 'm3', chatId: 'c2', senderId: 'u1', senderName: '张三',
            receiverId: 'u3', content: '辛苦了，到了给我发消息就行。',
            time: hourAgo(5), taskId: 't2', taskTitle: '代拿外卖',
            withdrawn: false
        }
    ];

    var conversations = [
        {
            id: 'c1', partnerId: 'u2', partnerName: '李四',
            partnerAvatar: users[1].avatar,
            taskId: 't1', taskTitle: '帮忙取快递',
            lastMessage: '好的，我 10 分钟后到宿舍楼下。', lastTime: hourAgo(2)
        },
        {
            id: 'c2', partnerId: 'u3', partnerName: '王同学',
            partnerAvatar: users[2].avatar,
            taskId: 't2', taskTitle: '代拿外卖',
            lastMessage: '辛苦了，到了给我发消息就行。', lastTime: hourAgo(5)
        }
    ];

    var reviews = [
        {
            id: 'r1', taskId: 't1', fromUserId: 'u1', fromUserName: '张三',
            toUserId: 'u2', toUserName: '李四', rating: 5,
            content: '非常准时，服务态度很好！', time: hourAgo(24)
        }
    ];

    return { users: users, tasks: tasks, messages: messages, conversations: conversations, reviews: reviews };
}

const DB_KEY = 'campus_mock_db';

function getDB() {
    var db = getStorage(DB_KEY, null);
    if (db && db.users && db.users.length > 0) {
        return db;
    }
    var initial = createInitialData();
    setStorage(DB_KEY, initial);
    return initial;
}

function saveDB(db) {
    setStorage(DB_KEY, db);
}

function getUserById(id) {
    var db = getDB();
    for (var i = 0; i < db.users.length; i++) {
        if (db.users[i].id === id) return db.users[i];
    }
    return null;
}

function getUserByUsername(username) {
    var db = getDB();
    for (var i = 0; i < db.users.length; i++) {
        if (db.users[i].username === username) return db.users[i];
    }
    return null;
}

function getUserByPhone(phone) {
    var db = getDB();
    for (var i = 0; i < db.users.length; i++) {
        if (db.users[i].phone === phone) return db.users[i];
    }
    return null;
}

function getUserByEmail(email) {
    var db = getDB();
    for (var i = 0; i < db.users.length; i++) {
        if (db.users[i].email === email) return db.users[i];
    }
    return null;
}

function getTaskById(id) {
    var db = getDB();
    for (var i = 0; i < db.tasks.length; i++) {
        if (db.tasks[i].id === id) return db.tasks[i];
    }
    return null;
}
