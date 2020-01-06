const express = require('express');
const db = require('../models');
const multer = require('multer');
const { isLoggedIn } = require('./middleware');
const path = require('path');
const router = express.Router();

const upload = multer({
	storage: multer.diskStorage({ // 서버쪽에 저장 하겠다.
    	destination(req, file, done) { // 어떤 경로에 저장 할지 
			done(null, 'uploads');
    	},
    	filename(req, file, done) {
      		const ext = path.extname(file.originalname);
      		const basename = path.basename(file.originalname, ext); // 제로초.png, ext===.png, basename===제로초
      		done(null, basename + new Date().valueOf() + ext);
    	},
  	}),
  	limits: { fileSize: 20 * 1024 * 1024 },
});
// 폼데이터 파일 -> req.file 폼데이터 일반 값 -> req.body
router.post('/', isLoggedIn, upload.none(), async (req, res, next) => { // POST /api/post  => 게시글 작성 라우터
    try{
    	const hashtags = req.body.content.match(/#[^\s]+/g);
		const newPost = await db.Post.create({
			content: req.body.content, // ex) 병진아 힘내 #힘내 #파이팅! 눌러주세요 
			UserId: req.user.id,
		})
		if (hashtags) {
			const result = await Promise.all(hashtags.map(tag => db.Hashtag.findOrCreate({ // findOrCreate 없으면 만들고 있으면 찾고 , 각각 다 저장 하려면 Promise.all을 사용 
				where: { name: tag.slice(1).toLowerCase() }, // slice(1)은 앞에 #을 떄는 거고 toLowerCase()는 영어 해쉬 태그는 소문자로 통일
			})));
			console.log(result);
			await newPost.addHashtags(result.map(r => r[0]));
		}
		if (req.body.image) { // 이미지 주소를 여러개 올리면 image: [주소1, 주소2]
      		if (Array.isArray(req.body.image)) { // 배열인지 아닌지 구분  // Promise.all 한방에 db 처리를 가능 하게 한다
        		const images = await Promise.all(req.body.image.map((image) => {
          		return db.Image.create({ src: image });
        	}));
        	await newPost.addImages(images); // 여러개인 경우
	      	} else { // 이미지를 하나만 올리면 image: 주소1
	        	const image = await db.Image.create({ src: req.body.image }); // 하나인 경우
	        	await newPost.addImage(image);
	      	}
    	}
		// const User = await newPost.getUser();
		// newPost.User = User
		// res.json(newPost)
		const fullPost = await db.Post.findOne({
      		where: { id: newPost.id },
      		include: [{
        		model: db.User,
        		attributes: ['id', 'nickname'],
      		}, {
        		model: db.Image,
      		}],
    	});
		res.json(fullPost)
    } catch(e){
    	console.error(e)
    	next(e)
    }
});

router.post('/images', upload.array('image'), (req, res) => {
	console.log(req.files);
	res.json(req.files.map(v => v.filename));
});

router.get('/:id/comments', async (req, res, next) => {
  	try {
    	const post = await db.Post.findOne({ where: { id: req.params.id } });
		if (!post) {
  			return res.status(404).send('포스트가 존재하지 않습니다.');
		}
    	const comments = await db.Comment.findAll({
      		where: {
        		PostId: req.params.id,
      		},
      		order: [['createdAt', 'ASC']],
      		include: [{
        		model: db.User,
        		attributes: ['id', 'nickname'],
      		}],
    	});
    	res.json(comments);
  	} catch (e) {
	    console.error(e);
	    next(e);
  	}
});
// isLoggedIn, 
router.post('/:id/comment', isLoggedIn, async (req, res, next) => { // POST /api/post/1000000/comment
	try {
		// console.log(req.user)
		// if(!req.user) {
		// 	return res.status(401).send("로그인이 필요 합니다.")
		// }
    	const post = await db.Post.findOne({ where: { id: req.params.id } });
	    if (!post) {
			return res.status(404).send('포스트가 존재하지 않습니다.');
	    }
    	const newComment = await db.Comment.create({
			PostId: post.id,
			UserId: req.user.id,
			content: req.body.content,
    	});
    	await post.addComment(newComment.id);
    	const comment = await db.Comment.findOne({
      		where: {
        		id: newComment.id,
      		},
      		include: [{
		        model: db.User,
		        attributes: ['id', 'nickname'],
      		}],
    	});
    	return res.json(comment);
  	} catch (e) {
    	console.error(e);
    	return next(e);
  	}
});

router.post('/:id/like', isLoggedIn, async (req, res, next) => {
    try {
        const post = await db.Post.findOne({ where: { id: req.params.id }});
        if (!post) {
            return res.status(404).send('포스트가 존재하지 않습니다.');
        }
        await post.addLiker(req.user.id);
        res.json({ userId: req.user.id });
    } catch (e) {
        console.error(e);
        next(e);
    }
});

router.delete('/:id/like', isLoggedIn, async (req, res, next) => {
    try {
        const post = await db.Post.findOne({ where: { id: req.params.id }});
        if (!post) {
            return res.status(404).send('포스트가 존재하지 않습니다.');
        }
        await post.removeLiker(req.user.id);
        res.json({ userId: req.user.id });
    } catch (e) {
        console.error(e);
        next(e);
    }
});

router.post('/:id/retweet', isLoggedIn, async (req, res, next) => {
    try {
        const post = await db.Post.findOne({
            where: { id: req.params.id },
            include: [{
                model: db.Post,
                as: 'Retweet',
            }],
        });
        if (!post) {
            return res.status(404).send('포스트가 존재하지 않습니다.');
        }
        if (req.user.id === post.UserId || (post.Retweet && post.Retweet.UserId === req.user.id)) {
            return res.status(403).send('자신의 글은 리트윗할 수 없습니다.');
        }
        const retweetTargetId = post.RetweetId || post.id;
        const exPost = await db.Post.findOne({
            where: {
                UserId: req.user.id,
                RetweetId: retweetTargetId,
            },
        });
        if (exPost) {
            return res.status(403).send('이미 리트윗했습니다.');
        }
        const retweet = await db.Post.create({
            UserId: req.user.id,
            RetweetId: retweetTargetId,
            content: 'retweet',
        });
        const retweetWithPrevPost = await db.Post.findOne({
            where: { id: retweet.id },
            include: [{
                model: db.User,
                attributes: ['id', 'nickname'],
            }, {
                model: db.Post,
                as: 'Retweet',
                include: [{
                    model: db.User,
                    attributes: ['id', 'nickname'],
                    }, {
                        model: db.Image,
                }],
            }],
        });
        res.json(retweetWithPrevPost);
    } catch (e) {
        console.error(e);
        next(e);
    }
});

module.exports = router;