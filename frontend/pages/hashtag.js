import React, { useEffect } from "react";
import { useDispatch, useSelector } from 'react-redux';
import { LOAD_HASHTAG_POSTS_REQUEST } from '../reducers/post';
import PostCard from '../components/PostCard';

const Hashtag = ({tag}) => {
	const dispatch = useDispatch()
	const { mainPosts } = useSelector(state => state.post);

	useEffect(() => {
		dispatch({
			type: LOAD_HASHTAG_POSTS_REQUEST,
			data: tag
		})
	},[])
	return (
		<div>
			{mainPosts.map(c => (
		        <PostCard key={+c.createdAt} post={c} />
			))}
		</div>
	)
}

Hashtag.getInitialProps = async(context) => { // 가장 최초에 작업을 할 수 있다. 서버사이드 랜더링 할 수 있다.
	return { tag: context.query.tag } 
}

export default Hashtag