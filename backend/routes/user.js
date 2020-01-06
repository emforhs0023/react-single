const express = require('express');
const bcrypt = require('bcrypt');
const passport = require('passport');
const db = require('../models');
const { isLoggedIn } = require('./middleware');
const router = express.Router();

router.get('/', (req, res) => { // /api/user/
  if (!req.user) {
    return res.status(401).send('로그인이 필요합니다.');
  }
  const user = Object.assign({}, req.user.toJSON());
  delete user.password;
  return res.json(user);
});
// 404 -> 페이지에러  못함  403->  금지 400 -> 요청 이상 401->  권한
router.post('/', async (req, res, next) => { // POST /api/user 회원가입
    try {
        const exUser = await db.User.findOne({
            where: {
                userId: req.body.userId,
            }
        })
        if (exUser) {
            return res.status(403).send('이미 사용중인 아이디입니다.'); // send는 문자열을 보내는것 
        }
        // 사용자가 없을때 로그인 과정 진행
        const hashedPassword = await bcrypt.hash(req.body.password, 12); // salt는 10~13 사이로 // 비밀 번호 암호화 

        const newUser = await db.User.create({ // 새로운 유저를 db에 저장 insert 같은 것 
            nickname: req.body.nickname,
            userId: req.body.userId,
            password: hashedPassword,
        });
        console.log(newUser);

        return res.status(200).json(newUser); // json은 json데이터를 보내는 것, 200 -> 성공
    } catch (e) {
        console.error(e);
        // 에러 처리를 여기서
        return next(e);
    }
});

router.get('/:id', async (req, res, next) => { // 남의 정보 가져오는 것 ex) /api/user/123
    try {
        const user = await db.User.findOne({
            where: { id: parseInt(req.params.id, 10) },
            include: [{
                model: db.Post,
                as: 'Posts',
                attributes: ['id'],
            }, {
                model: db.User,
                as: 'Followings',
                attributes: ['id'],
            }, {
                model: db.User,
                as: 'Followers',
                attributes: ['id'],
            }],
            attributes: ['id', 'nickname'],
        });
        const jsonUser = user.toJSON();
        jsonUser.Posts = jsonUser.Posts ? jsonUser.Posts.length : 0; // 총 몇개 인지만 보안  
        jsonUser.Followings = jsonUser.Followings ? jsonUser.Followings.length : 0; // 총 몇개 인지만 보안  
        jsonUser.Followers = jsonUser.Followers ? jsonUser.Followers.length : 0; // 총 몇개 인지만 보안  
        res.json(jsonUser);
    } catch (e) {
        console.error(e);
        next(e);
    }
});
router.post('/logout', (req, res) => { // /api/user/logout
    req.logout();
    req.session.destroy();
    res.send('logout 성공');
});

router.post('/login', (req, res, next) => { // POST /api/user/login
    passport.authenticate('local', (err, user, info) => { // LocalStrategy를 사용 해서 local을 사용 , 카카오를 사용 하면 kakao, navar를 사용 하면 naver
        // console.log(info)
        if (err) { // 서버에러가 났다.                 // err, user, info 는 passport 의 done(null, false, {}) 과 에서 온 것 이다.
            console.error(err);
            return next(err);
        }
        if (info) { // 로직상의 에러가 있는 경우
            return res.status(401).send(info.reason);
        } 
        return req.login(user, async (loginErr) => { // 로그인이 성공 하면 쿠키와 세션에 저장 된다. //serializeUser 실행 
            try {
                if (loginErr) {
                    return next(loginErr);
                }
                // console.log("asdfasdf", user)
                // const fillteredUser = Object.assign({}, user.toJSON()); // ({}, )이는 새로운 객체를 타깃으로 (리턴할) 한다는 의미
                // delete fillteredUser.password
                const fullUser = await db.User.findOne({
                    where: { id: user.id },
                    include: [{
                        model: db.Post,
                        as: 'Posts',
                        attributes: ['id'],
                    }, {
                        model: db.User,
                        as: 'Followings',
                        attributes: ['id'],
                    }, {
                        model: db.User,
                        as: 'Followers',
                        attributes: ['id'],
                    }],
                        attributes: ['id', 'nickname', 'userId'],
                    });
                    // console.log(fullUser);
                return res.json(fullUser); // 비밀번호를 프론트로 바로 보내는건 위험하니까 fullUser로 처리 해준다.
            } catch (e) {
                next(e);
            }
        });
    })(req, res, next);
});

// router.get('/:id/follow', (req, res) => { // /api/user/:id/follow

// });

// router.delete('/:id/follower', (req, res) => {

// });

router.post('/:id/follow', isLoggedIn, async (req, res, next) => {
    try {
        const me = await db.User.findOne({
            where: { id: req.user.id },
        });
        await me.addFollowing(req.params.id);
        res.send(req.params.id);
    } catch (e) {
        console.error(e);
        next(e);
    }
});

router.delete('/:id/follow', isLoggedIn, async (req, res, next) => {
    try {
        const me = await db.User.findOne({
            where: { id: req.user.id },
        });
        await me.removeFollowing(req.params.id);
        res.send(req.params.id);
    } catch (e) {
        console.error(e);
        next(e);
    }
});


router.get('/:id/posts', async (req, res, next) => {
    try {
        const posts = await db.Post.findAll({
            where: {
                UserId: parseInt(req.params.id, 10),
                RetweetId: null,
            },
            include: [{
                model: db.User,
                attributes: ['id', 'nickname'],
            }, {
                model: db.Image,
            }, {
                model: db.User,
                through: 'Like',
                as: 'Likers',
                attributes: ['id'],
            }],
        });
        res.json(posts);
    } catch (e) {
        console.error(e);
        next(e);
    }
});

router.get('/:id/followings', isLoggedIn, async (req, res, next) => { // /api/user/:id/followings
    try {
        const user = await db.User.findOne({
            where: { id: parseInt(req.params.id, 10) },
        });
        const followers = await user.getFollowings({
            attributes: ['id', 'nickname'],
        });
        res.json(followers);
  } catch (e) {
    console.error(e);
    next(e);
  }
});

router.get('/:id/followers', isLoggedIn, async (req, res, next) => { // /api/user/:id/followers
    try {
        const user = await db.User.findOne({
            where: { id: parseInt(req.params.id, 10) },
        });
        const followers = await user.getFollowers({
            attributes: ['id', 'nickname'],
        });
        res.json(followers);
    } catch (e) {
        console.error(e);
        next(e);
    }
});

router.delete('/:id/follower', isLoggedIn, async (req, res, next) => {
    try {
        const me = await db.User.findOne({
            where: { id: req.user.id },
        });
        await me.removeFollower(req.params.id);
        res.send(req.params.id);
    } catch (e) {
        console.error(e);
        next(e);
    }
});

router.patch('/nickname', isLoggedIn, async (req, res, next) => {
    try {
        await db.User.update({
            nickname: req.body.nickname,
        }, {
            where: { id: req.user.id },
        });
        res.send(req.body.nickname);
    } catch (e) {
        console.error(e);
        next(e);
    }
});

module.exports = router;