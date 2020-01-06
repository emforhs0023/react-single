import React, { useEffect } from "react";
import { useDispatch, useSelector } from 'react-redux';
import { Avatar, Card } from 'antd';
import { LOAD_HASHTAG_POSTS_REQUEST, LOAD_USER_POSTS_REQUEST } from '../reducers/post'
import { LOAD_USER_REQUEST } from '../reducers/user';
import PostCard from '../components/PostCard';

const User = ({ id }) => {
	const dispatch = useDispatch()
	const { mainPosts } = useSelector(state => state.post);
	const { userInfo } = useSelector(state => state.user);

	useEffect(() => {
	    dispatch({ // 남의 정보 
			type: LOAD_USER_REQUEST,
			data: id,
		});
		dispatch({ // 남의 게시물
			type: LOAD_USER_POSTS_REQUEST,
			data: id
		})
	},[])
	return (
		<div>
		{userInfo
		?(
			<Card
				actions={[
					<div key="twit">
						짹짹
	                	<br />
	                	{userInfo.Posts}
	          		</div>,
	              	<div key="following">
	                	팔로잉
	                	<br />
	                	{userInfo.Followings}
	              	</div>,
	              	<div key="follower">
	                	팔로워
	                	<br />
	                	{userInfo.Followers}
	              	</div>,
	            ]}
			>
	            <Card.Meta
					avatar={<Avatar>{userInfo.nickname[0]}</Avatar>}
					title={userInfo.nickname}
	            />
          	</Card>
        )
		: null
		} 
			{mainPosts.map(c => (
				<PostCard key={+c.createAt} post={c} />
		    ))}
		</div>
	)
}

User.getInitialProps = async(context) => { // 가장 최초에 작업을 할 수 있다. 서버사이드 랜더링 할 수 있다.
	console.log("User", context.query.id)
	return { id: parseInt(context.query.id)  } 
}

export default User