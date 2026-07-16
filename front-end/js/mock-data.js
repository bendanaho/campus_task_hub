// 自动确认 / 评价窗口共用的天数
const AUTO_DAYS = 2;

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
            id: 'u1', username: '张三', phone: '13800138001', email: 'zhangsan@example.com', password: '1',
            avatar: 'https://picsum.photos/seed/avatar1/200/200',
            creditScore: 4.8, authStatus: 'verified', balance: 85,
            realName: '张小明', studentId: '2021010001',
            college: '计算机学院', className: '软件工程2101',
            bio: '乐于助人，常在线，愿意参与校园互助任务。'
        },
        {
            id: 'u2', username: '李四', phone: '13800138002', email: 'lisi@example.com', password: '1',
            avatar: 'https://picsum.photos/seed/avatar2/200/200',
            creditScore: 4.2, authStatus: 'verified', balance: 85,
            realName: '李华', studentId: '2021020002',
            college: '经济管理学院', className: '金融学2102',
            bio: '喜欢帮助别人，课余时间比较多。'
        },
        {
            id: 'u3', username: '王同学', phone: '13800138003', email: 'wang@example.com', password: '1',
            avatar: '', creditScore: 3.5, authStatus: 'verified', balance: 80,
            realName: '王同学', studentId: '2021030003', college: '外国语学院', className: '英语2103',
            bio: '新用户，正在探索平台功能。'
        },
        {
            id: 'u4', username: '陈同学', phone: '13800138004', email: 'chen@example.com', password: '1',
            avatar: 'https://picsum.photos/seed/avatar4/200/200',
            creditScore: 2.8, authStatus: 'verified', balance: 100,
            realName: '陈志强', studentId: '2021030004',
            college: '机械工程学院', className: '机械设计2101',
            bio: '做事认真负责，但有时回复较慢。'
        },
        {
            id: 'u5', username: '赵同学', phone: '13800138005', email: 'zhao@example.com', password: '1',
            avatar: 'https://picsum.photos/seed/avatar5/200/200',
            creditScore: 4.9, authStatus: 'verified', balance: 100,
            realName: '赵雨薇', studentId: '2021040005',
            college: '设计学院', className: '视觉传达2103',
            bio: '设计专业学生，擅长海报和PPT制作。'
        },
        {
            id: 'u6', username: '刘同学', phone: '13800138006', email: 'liu@example.com', password: '1',
            avatar: '', creditScore: 3.9, authStatus: 'verified', balance: 100,
            realName: '刘志强', studentId: '2021060006', college: '理学院', className: '数学2101',
            bio: '数学系学生，乐于助人。'
        },
        {
            id: 'u7', username: '孙同学', phone: '13800138007', email: 'sun@example.com', password: '1',
            avatar: 'https://picsum.photos/seed/avatar7/200/200',
            creditScore: 4.6, authStatus: 'verified', balance: 105,
            realName: '孙文博', studentId: '2021050007',
            college: '外国语学院', className: '英语2101',
            bio: '英语口语流利，喜欢交朋友。'
        },
        {
            id: 'u8', username: '周同学', phone: '13800138008', email: 'zhou@example.com', password: '1',
            avatar: '', creditScore: 2.5, authStatus: 'verified', balance: 100,
            realName: '周佳', studentId: '2021080008', college: '文学院', className: '汉语言2101',
            bio: '校内打印店兼职，可以帮忙打印资料。'
        },
        {
            // 平台管理员（role: 1，普通用户 role 缺省视为 0）。
            // 不参与交易，负责争议订单仲裁与内容管理；登录后导航栏出现「管理后台」。
            id: 'u9', username: 'admin', phone: '13800138009', email: 'admin@example.com', password: '1',
            avatar: 'https://picsum.photos/seed/avatarAdmin/200/200',
            creditScore: 5.0, authStatus: 'verified', balance: 0, role: 1,
            realName: '平台管理员', studentId: 'ADMIN', college: '平台运营', className: '管理组',
            bio: '平台管理员，负责争议订单仲裁与内容管理。'
        }
    ];

    var tasks = [
        {
            id: 't1', title: '帮忙取快递', publisherSide: 'payer', category: 'errand',
            description: '从学校菜鸟驿站取一个中等大小快递，送到 3 号宿舍楼下即可。',
            publisherId: 'u1', publisherName: '张三', publisherCredit: 4.8,
            reward: '5元', rewardValue: 5,
            deadline: dayAgo(-1), publishTime: hourAgo(26),
            status: 'closed', contact: '站内联系',
            images: ['https://picsum.photos/seed/task1a/300/200']
        },
        {
            id: 't2', title: '代拿外卖', publisherSide: 'payer', category: 'errand',
            description: '帮忙从东门外卖柜取餐，送到教学楼 A 区门口。',
            publisherId: 'u2', publisherName: '李四', publisherCredit: 4.2,
            reward: '4元', rewardValue: 4,
            deadline: dayAgo(-1), publishTime: hourAgo(30),
            status: 'closed', contact: '站内联系', images: []
        },
        {
            id: 't3', title: '宿舍搬运行李', publisherSide: 'payer', category: 'life-service',
            description: '需要帮忙把两个行李箱从 1 号宿舍楼搬到 8 号宿舍楼，有电梯。',
            publisherId: 'u4', publisherName: '陈同学', publisherCredit: 2.8,
            reward: '15元', rewardValue: 15,
            deadline: dayAgo(-2), publishTime: hourAgo(48),
            status: 'open', contact: '微信联系',
            images: ['https://picsum.photos/seed/task3a/300/200']
        },
        {
            id: 't4', title: '帮修电脑无法联网问题', publisherSide: 'payer', category: 'skill-help',
            description: '笔记本电脑连不上校园网，想请懂电脑的同学帮忙排查一下问题。',
            publisherId: 'u3', publisherName: '王同学', publisherCredit: 3.5,
            reward: '20元', rewardValue: 20,
            deadline: dayAgo(-1), publishTime: hourAgo(12),
            status: 'open', contact: '电话联系', images: []
        },
        {
            id: 't5', title: '社团海报设计', publisherSide: 'payer', category: 'skill-help',
            description: '需要一张活动宣传海报，风格活泼简洁，今晚可先出草稿更好。',
            publisherId: 'u5', publisherName: '赵同学', publisherCredit: 4.9,
            reward: '30元', rewardValue: 30,
            deadline: dayAgo(-3), publishTime: hourAgo(36),
            status: 'open', contact: 'QQ联系',
            images: ['https://picsum.photos/seed/task5a/300/200', 'https://picsum.photos/seed/task5b/300/200']
        },
        {
            id: 't6', title: '图书馆占座', publisherSide: 'payer', category: 'study-help',
            description: '明天早上 8 点前在图书馆三楼帮忙占一个座位，靠窗优先。',
            publisherId: 'u6', publisherName: '刘同学', publisherCredit: 3.9,
            reward: '3元', rewardValue: 3,
            deadline: dayAgo(-1), publishTime: hourAgo(44),
            status: 'open', contact: '站内联系', images: []
        },
        {
            id: 't7', title: '高数题目答疑', publisherSide: 'payer', category: 'study-help',
            description: '想请一位同学帮忙讲解几道高等数学极限题，线下 30 分钟左右。',
            publisherId: 'u7', publisherName: '孙同学', publisherCredit: 4.6,
            reward: '10元', rewardValue: 10,
            deadline: dayAgo(-2), publishTime: hourAgo(15),
            status: 'open', contact: '微信联系', images: []
        },
        {
            id: 't8', title: '借实验课报告模板', publisherSide: 'payer', category: 'material-share',
            description: '想找一份上学期实验课报告模板作参考，有偿求助。',
            publisherId: 'u8', publisherName: '周同学', publisherCredit: 2.5,
            reward: '2元', rewardValue: 2,
            deadline: dayAgo(-1), publishTime: hourAgo(42),
            status: 'open', contact: '站内联系', images: []
        },
        {
            id: 't9', title: '求数据库课程笔记', publisherSide: 'payer', category: 'material-share',
            description: '想购买一份数据库原理的期中复习笔记，最好是本学期老师上课版本。',
            publisherId: 'u1', publisherName: '张三', publisherCredit: 4.8,
            reward: '5元', rewardValue: 5,
            deadline: dayAgo(-3), publishTime: hourAgo(27),
            status: 'open', contact: 'QQ联系',
            images: ['https://picsum.photos/seed/task9a/300/200']
        },
        {
            id: 't10', title: '转让二手台灯', publisherSide: 'payer', category: 'item-trade',
            description: '毕业清理闲置，转让一盏九成新护眼台灯，可在宿舍区当面交易。',
            publisherId: 'u2', publisherName: '李四', publisherCredit: 4.2,
            reward: '25元', rewardValue: 25,
            deadline: dayAgo(-5), publishTime: hourAgo(29),
            status: 'open', contact: '电话联系',
            images: ['https://picsum.photos/seed/task10a/300/200', 'https://picsum.photos/seed/task10b/300/200', 'https://picsum.photos/seed/task10c/300/200']
        },
        {
            id: 't11', title: '求购二手自行车', publisherSide: 'payer', category: 'item-trade',
            description: '想收一辆能正常骑行的二手自行车，预算 150 元以内，校内面交。',
            publisherId: 'u4', publisherName: '陈同学', publisherCredit: 2.8,
            reward: '面议', rewardValue: 0,
            deadline: dayAgo(-7), publishTime: hourAgo(72),
            status: 'open', contact: '微信联系', images: []
        },
        {
            id: 't12', title: '羽毛球搭子招募', publisherSide: 'none', category: 'teamwork',
            description: '想找一位每周二、周四晚上一起打羽毛球的搭子，水平不限。',
            publisherId: 'u5', publisherName: '赵同学', publisherCredit: 4.9,
            reward: '无', rewardValue: 0,
            deadline: dayAgo(-30), publishTime: hourAgo(35),
            status: 'open', contact: '站内联系', images: []
        },
        {
            id: 't13', title: '数学建模比赛组队', publisherSide: 'none', category: 'teamwork',
            description: '准备参加校级数学建模比赛，想找会写论文或会编程的同学组队。',
            publisherId: 'u3', publisherName: '王同学', publisherCredit: 3.5,
            reward: '无', rewardValue: 0,
            deadline: dayAgo(-14), publishTime: hourAgo(14),
            status: 'open', contact: 'QQ联系', images: []
        },
        {
            id: 't14', title: '失物招领信息代发布', publisherSide: 'payer', category: 'other',
            description: '帮忙把一则失物招领信息转发到年级群，完成后截图即可。',
            publisherId: 'u6', publisherName: '刘同学', publisherCredit: 3.9,
            reward: '1元', rewardValue: 1,
            deadline: dayAgo(-1), publishTime: hourAgo(18),
            status: 'open', contact: '站内联系', images: []
        },
        {
            id: 't15', title: '可长期代取快递', publisherSide: 'earner', category: 'errand',
            description: '工作日傍晚可帮忙代取快递，覆盖西区宿舍，响应较快，支持提前联系。',
            publisherId: 'u7', publisherName: '孙同学', publisherCredit: 4.6,
            reward: '3-5元/单', rewardValue: 4,
            deadline: dayAgo(-30), publishTime: hourAgo(16),
            status: 'open', contact: '微信联系',
            images: ['https://picsum.photos/seed/task15a/300/200']
        },
        {
            id: 't16', title: '可代买早餐和日用品', publisherSide: 'earner', category: 'errand',
            description: '早上可顺路代买早餐、矿泉水、纸巾等日用品，南区宿舍优先。',
            publisherId: 'u8', publisherName: '周同学', publisherCredit: 2.5,
            reward: '2-6元/次', rewardValue: 4,
            deadline: dayAgo(-30), publishTime: hourAgo(7),
            status: 'open', contact: '电话联系', images: []
        },
        {
            id: 't17', title: '提供 PPT 美化与排版服务', publisherSide: 'earner', category: 'skill-help',
            description: '可帮忙优化课程汇报 PPT、社团展示 PPT，支持简约风、学术风、活泼风。',
            publisherId: 'u1', publisherName: '张三', publisherCredit: 4.8,
            reward: '20元起', rewardValue: 20,
            deadline: dayAgo(-30), publishTime: hourAgo(21),
            status: 'open', contact: 'QQ联系',
            images: ['https://picsum.photos/seed/task17a/300/200']
        },
        {
            id: 't18', title: '提供基础电脑故障排查', publisherSide: 'earner', category: 'skill-help',
            description: '可协助处理系统卡顿、软件安装、打印机连接、校园网基础问题等。',
            publisherId: 'u2', publisherName: '李四', publisherCredit: 4.2,
            reward: '15元起', rewardValue: 15,
            deadline: dayAgo(-30), publishTime: hourAgo(13),
            status: 'open', contact: '微信联系', images: []
        },
        {
            id: 't19', title: '高数一对一答疑辅导', publisherSide: 'earner', category: 'study-help',
            description: '可辅导极限、导数、积分等基础内容，适合期中前突击复习。',
            publisherId: 'u5', publisherName: '赵同学', publisherCredit: 4.9,
            reward: '25元/小时', rewardValue: 25,
            deadline: dayAgo(-30), publishTime: hourAgo(18),
            status: 'open', contact: '站内联系', images: []
        },
        {
            id: 't20', title: '英语口语陪练', publisherSide: 'earner', category: 'study-help',
            description: '可陪练四六级口语、自我介绍、日常对话，适合基础薄弱同学。',
            publisherId: 'u4', publisherName: '陈同学', publisherCredit: 2.8,
            reward: '18元/30分钟', rewardValue: 18,
            deadline: dayAgo(-30), publishTime: hourAgo(20),
            status: 'open', contact: '电话联系',
            images: ['https://picsum.photos/seed/task20a/300/200', 'https://picsum.photos/seed/task20b/300/200']
        },
        {
            id: 't21', title: '出售整理版期中复习资料', publisherSide: 'earner', category: 'material-share',
            description: '提供数据库、数据结构、大学物理等课程的重点整理资料，可发电子版。',
            publisherId: 'u7', publisherName: '孙同学', publisherCredit: 4.6,
            reward: '8元/份', rewardValue: 8,
            deadline: dayAgo(-30), publishTime: hourAgo(17),
            status: 'open', contact: 'QQ联系', images: []
        },
        {
            id: 't22', title: '帮忙打印装订资料', publisherSide: 'earner', category: 'life-service',
            description: '可代打印课程作业、论文、简历等，支持黑白和彩印，晚间也可联系。',
            publisherId: 'u8', publisherName: '周同学', publisherCredit: 2.5,
            reward: '按页计费', rewardValue: 0,
            deadline: dayAgo(-30), publishTime: hourAgo(10),
            status: 'open', contact: '微信联系',
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
            id: 'm3', chatId: 'c2', senderId: 'u2', senderName: '李四',
            receiverId: 'u1', content: '辛苦了，到了给我发消息就行。',
            time: hourAgo(8.5), taskId: 't2', taskTitle: '代拿外卖',
            withdrawn: false
        },
        {
            id: 'm4', chatId: 'c1', senderId: 'system', senderName: '系统',
            receiverId: '', content: '李四已接单',
            time: hourAgo(3), taskId: 't1', taskTitle: '帮忙取快递',
            withdrawn: false
        },
        {
            id: 'm5', chatId: 'c1', senderId: 'system', senderName: '系统',
            receiverId: '', content: '张三已预付报酬 5 元，任务开始执行',
            time: hourAgo(2.5), taskId: 't1', taskTitle: '帮忙取快递',
            withdrawn: false
        },
        {
            id: 'm6', chatId: 'c2', senderId: 'system', senderName: '系统',
            receiverId: '', content: '张三已接单',
            time: hourAgo(10), taskId: 't2', taskTitle: '代拿外卖',
            withdrawn: false
        },
        {
            id: 'm7', chatId: 'c2', senderId: 'system', senderName: '系统',
            receiverId: '', content: '李四已预付报酬 4 元，任务开始执行',
            time: hourAgo(9), taskId: 't2', taskTitle: '代拿外卖',
            withdrawn: false
        },
        {
            id: 'm8', chatId: 'c2', senderId: 'system', senderName: '系统',
            receiverId: '', content: '双方已确认任务完成，款项已结算',
            time: hourAgo(8), taskId: 't2', taskTitle: '代拿外卖',
            withdrawn: false
        },
        {
            id: 'm9', chatId: 'c3', senderId: 'u1', senderName: '张三',
            receiverId: 'u7', content: '帮我取个快递，菜鸟驿站的',
            time: hourAgo(50), taskId: 't15', taskTitle: '可长期代取快递',
            withdrawn: false
        },
        {
            id: 'm10', chatId: 'c3', senderId: 'u7', senderName: '孙同学',
            receiverId: 'u1', content: '好的，晚上 7 点送到你宿舍',
            time: hourAgo(49), taskId: 't15', taskTitle: '可长期代取快递',
            withdrawn: false
        },
        {
            id: 'm11', chatId: 'c3', senderId: 'system', senderName: '系统',
            receiverId: '', content: '服务已完成，款项已结算',
            time: hourAgo(24), taskId: 't15', taskTitle: '可长期代取快递',
            withdrawn: false
        },
        {
            id: 'm12', chatId: 'c4', senderId: 'u1', senderName: '张三',
            receiverId: 'u8', content: '明天早上帮我带一份豆浆',
            time: hourAgo(12), taskId: 't16', taskTitle: '可代买早餐和日用品',
            withdrawn: false
        },
        {
            id: 'm13', chatId: 'c4', senderId: 'system', senderName: '系统',
            receiverId: '', content: '周同学已同意接单，服务开始执行',
            time: hourAgo(11), taskId: 't16', taskTitle: '可代买早餐和日用品',
            withdrawn: false
        },
        {
            id: 'm14', chatId: 'c5', senderId: 'system', senderName: '系统',
            receiverId: '', content: '服务申请者已申请服务，等待服务提供者确认',
            time: hourAgo(2), taskId: 't17', taskTitle: '提供 PPT 美化与排版服务',
            withdrawn: false
        },
        {
            id: 'm15', chatId: 'c6', senderId: 'u2', senderName: '李四',
            receiverId: 'u5', content: '高数答疑可以今晚开始吗？',
            time: hourAgo(20), taskId: 't19', taskTitle: '高数一对一答疑辅导',
            withdrawn: false
        },
        {
            id: 'm16', chatId: 'c6', senderId: 'system', senderName: '系统',
            receiverId: '', content: '赵同学已同意接单，服务开始执行',
            time: hourAgo(19), taskId: 't19', taskTitle: '高数一对一答疑辅导',
            withdrawn: false
        },
        {
            id: 'm17', chatId: 'c6', senderId: 'system', senderName: '系统',
            receiverId: '', content: '李四已确认服务完成，等待提供者确认（2天后自动确认）',
            time: hourAgo(10), taskId: 't19', taskTitle: '高数一对一答疑辅导',
            withdrawn: false
        },
        // 未读演示：李四、孙同学发给张三、尚未查看的消息（read:false）
        {
            id: 'm18', chatId: 'c1', senderId: 'u2', senderName: '李四',
            receiverId: 'u1', content: '快递到了，你现在方便下来拿吗？',
            time: hourAgo(0.3), taskId: 't1', taskTitle: '帮忙取快递',
            withdrawn: false, read: false
        },
        {
            id: 'm19', chatId: 'c3', senderId: 'u7', senderName: '孙同学',
            receiverId: 'u1', content: '下次的快递也照旧放前台哈～',
            time: hourAgo(0.6), taskId: 't15', taskTitle: '可长期代取快递',
            withdrawn: false, read: false
        }
    ];

    var conversations = [
        {
            id: 'c1', partnerId: 'u2', partnerName: '李四',
            partnerAvatar: users[1].avatar,
            taskId: 't1', taskTitle: '帮忙取快递',
            lastMessage: '好的，我 10 分钟后到宿舍楼下。', lastTime: hourAgo(2),
            lastMessageSenderId: 'u2'
        },
        {
            id: 'c2', partnerId: 'u2', partnerName: '李四',
            partnerAvatar: users[1].avatar,
            taskId: 't2', taskTitle: '代拿外卖',
            lastMessage: '双方已确认任务完成，款项已结算', lastTime: hourAgo(8),
            lastMessageSenderId: 'system'
        },
        {
            id: 'c3', partnerId: 'u7', partnerName: '孙同学',
            partnerAvatar: users[6].avatar,
            taskId: 't15', taskTitle: '可长期代取快递',
            lastMessage: '服务已完成，款项已结算', lastTime: hourAgo(24),
            lastMessageSenderId: 'system'
        },
        {
            id: 'c4', partnerId: 'u8', partnerName: '周同学',
            partnerAvatar: users[7].avatar,
            taskId: 't16', taskTitle: '可代买早餐和日用品',
            lastMessage: '周同学已同意接单，服务开始执行', lastTime: hourAgo(11),
            lastMessageSenderId: 'system'
        },
        {
            id: 'c5', partnerId: 'u1', partnerName: '张三',
            partnerAvatar: users[0].avatar,
            taskId: 't17', taskTitle: '提供 PPT 美化与排版服务',
            lastMessage: '消费者已申请服务，等待服务提供者确认', lastTime: hourAgo(2),
            lastMessageSenderId: 'system'
        },
        {
            id: 'c6', partnerId: 'u5', partnerName: '赵同学',
            partnerAvatar: users[4].avatar,
            taskId: 't19', taskTitle: '高数一对一答疑辅导',
            lastMessage: '李四已确认服务完成，等待提供者确认（2天后自动确认）', lastTime: hourAgo(10),
            lastMessageSenderId: 'system'
        }
    ];

    // 种子评价：信用分由这些评价按贝叶斯公式算出（见本函数结尾），不再硬编码。
    // fromUserId 仅为来源，评分只影响 toUserId 的信用分。
    function rev(id, from, fromName, to, toName, rating, content, h) {
        return { id: id, taskId: 't1', fromUserId: from, fromUserName: fromName,
            toUserId: to, toUserName: toName, rating: rating, content: content, time: hourAgo(h), auto: false };
    }
    var reviews = [
        rev('r1', 'u1', '张三', 'u2', '李四', 5, '非常准时，服务态度很好！', 24),
        rev('r2', 'u1', '张三', 'u7', '孙同学', 5, '取快递很及时，下次还会找他！', 23),
        // u1 张三（高分）
        rev('r3', 'u2', '李四', 'u1', '张三', 5, '沟通顺畅，靠谱', 40),
        rev('r4', 'u3', '王同学', 'u1', '张三', 4, '整体不错', 39),
        // u2 李四（较高）
        rev('r5', 'u3', '王同学', 'u2', '李四', 4, '还行', 38),
        rev('r6', 'u4', '陈同学', 'u2', '李四', 4, '可以', 37),
        // u3 王同学（中）
        rev('r7', 'u1', '张三', 'u3', '王同学', 3, '一般般', 36),
        rev('r8', 'u5', '赵同学', 'u3', '王同学', 3, '有点慢', 35),
        // u4 陈同学（偏低）
        rev('r9', 'u1', '张三', 'u4', '陈同学', 2, '响应较慢', 34),
        rev('r10', 'u2', '李四', 'u4', '陈同学', 2, '体验一般', 33),
        // u5 赵同学（高）
        rev('r11', 'u6', '刘同学', 'u5', '赵同学', 5, '很专业', 32),
        rev('r12', 'u7', '孙同学', 'u5', '赵同学', 5, '好评', 31),
        // u6 刘同学（中上）
        rev('r13', 'u5', '赵同学', 'u6', '刘同学', 4, '不错', 30),
        rev('r14', 'u8', '周同学', 'u6', '刘同学', 4, '满意', 29),
        // u7 孙同学（高）：已有 r2(5) 再加一条
        rev('r15', 'u3', '王同学', 'u7', '孙同学', 4, '挺好', 28),
        // u8 周同学（低）
        rev('r16', 'u1', '张三', 'u8', '周同学', 1, '爽约了', 27),
        rev('r17', 'u2', '李四', 'u8', '周同学', 2, '不太靠谱', 26),
        rev('r18', 'u5', '赵同学', 'u8', '周同学', 2, '拖延', 25)
    ];

    // 统一订单表：取代旧 serviceOrders + 旧 task 上的订单字段。
    // 角色固定为 payer(付款方) / earner(收款方)，钱永远 payer → earner。
    // status: pending | in_progress | completed | cancelled | disputed | closed
    //   （disputed / closed 为阶段二「争议/管理员」预留，阶段一不会进入）
    var orders = [
        // 悬赏帖 t1：发布者 u1 出钱(payer)，u2 接单(earner)，进行中、双方都未确认
        {
            id: 'o1', postId: 't1', chatId: 'c1',
            payerId: 'u1', earnerId: 'u2', amount: 5,
            status: 'in_progress',
            payerConfirmed: false, earnerConfirmed: false,
            createdAt: hourAgo(3), acceptedAt: hourAgo(2.5),
            completedAt: null, autoConfirmAt: null, reviewDeadline: null
        },
        // 悬赏帖 t2：发布者 u2 出钱(payer)，u1 接单(earner)，已完成
        {
            id: 'o2', postId: 't2', chatId: 'c2',
            payerId: 'u2', earnerId: 'u1', amount: 4,
            status: 'completed',
            payerConfirmed: true, earnerConfirmed: true,
            createdAt: hourAgo(10), acceptedAt: hourAgo(9),
            completedAt: hourAgo(8), autoConfirmAt: null,
            reviewDeadline: new Date(now.getTime() - 8 * 3600000 + AUTO_DAYS * 86400000).toISOString()
        },
        // 服务帖 t15：发布者 u7 收钱(earner)，u1 下单(payer)，已完成
        {
            id: 'o3', postId: 't15', chatId: 'c3',
            payerId: 'u1', earnerId: 'u7', amount: 5,
            status: 'completed',
            payerConfirmed: true, earnerConfirmed: true,
            createdAt: hourAgo(50), acceptedAt: hourAgo(49),
            completedAt: hourAgo(24), autoConfirmAt: null,
            reviewDeadline: new Date(now.getTime() - 24 * 3600000 + AUTO_DAYS * 86400000).toISOString()
        },
        // 服务帖 t16：发布者 u8 收钱(earner)，u1 下单(payer)，进行中
        {
            id: 'o4', postId: 't16', chatId: 'c4',
            payerId: 'u1', earnerId: 'u8', amount: 10,
            status: 'in_progress',
            payerConfirmed: false, earnerConfirmed: false,
            createdAt: hourAgo(12), acceptedAt: hourAgo(11),
            completedAt: null, autoConfirmAt: null, reviewDeadline: null
        },
        // 服务帖 t17：发布者 u1 收钱(earner)，u3 下单(payer)，待 u1 接受(pending)
        {
            id: 'o5', postId: 't17', chatId: 'c5',
            payerId: 'u3', earnerId: 'u1', amount: 20,
            status: 'pending',
            payerConfirmed: false, earnerConfirmed: false,
            createdAt: hourAgo(2), acceptedAt: null,
            completedAt: null, autoConfirmAt: null, reviewDeadline: null
        },
        // 服务帖 t19：发布者 u5 收钱(earner)，u2 下单(payer)，进行中、付款方已确认、挂了自动确认
        {
            id: 'o6', postId: 't19', chatId: 'c6',
            payerId: 'u2', earnerId: 'u5', amount: 15,
            status: 'in_progress',
            payerConfirmed: true, earnerConfirmed: false,
            createdAt: hourAgo(36), acceptedAt: hourAgo(35),
            completedAt: null, autoConfirmAt: dayAgo(-2), reviewDeadline: null
        }
    ];

    // 资金流水（账单）。direction: 'in'(收入) | 'out'(支出)。
    // 与上面订单的资金流对齐：接受时冻结=付款方支出，完成结算=收款方收入。
    var transactions = [
        { id: 'tx1', userId: 'u1', direction: 'out', amount: 5, category: 'order', relatedId: 'o1', note: '订单支付：帮忙取快递', time: hourAgo(2.5) },
        { id: 'tx2', userId: 'u1', direction: 'in', amount: 4, category: 'order', relatedId: 'o2', note: '订单收入：代拿外卖', time: hourAgo(8) },
        { id: 'tx3', userId: 'u2', direction: 'out', amount: 4, category: 'order', relatedId: 'o2', note: '订单支付：代拿外卖', time: hourAgo(9) },
        { id: 'tx4', userId: 'u1', direction: 'out', amount: 5, category: 'order', relatedId: 'o3', note: '订单支付：可长期代取快递', time: hourAgo(49) },
        { id: 'tx5', userId: 'u7', direction: 'in', amount: 5, category: 'order', relatedId: 'o3', note: '订单收入：可长期代取快递', time: hourAgo(24) },
        { id: 'tx6', userId: 'u1', direction: 'out', amount: 10, category: 'order', relatedId: 'o4', note: '订单支付：可代买早餐和日用品', time: hourAgo(11) },
        { id: 'tx7', userId: 'u2', direction: 'out', amount: 15, category: 'order', relatedId: 'o6', note: '订单支付：高数一对一答疑辅导', time: hourAgo(35) },
        { id: 'tx8', userId: 'u1', direction: 'in', amount: 50, category: 'recharge', relatedId: null, note: '账户充值', time: hourAgo(52) }
    ];

    // 信用分改为「由评价驱动」：种子阶段即按种子评价重算，覆盖用户对象上的初始硬编码值，
    // 使「信用分 = 评价平均(贝叶斯)」从一开始就自洽。无评价者 → 5.0。
    users.forEach(function(u) {
        var ratings = reviews.filter(function(r) { return r.toUserId === u.id; }).map(function(r) { return r.rating; });
        u.creditScore = computeCreditScore(ratings);
    });

    return { users: users, tasks: tasks, messages: messages, conversations: conversations, reviews: reviews, orders: orders, transactions: transactions, reports: [] };
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
