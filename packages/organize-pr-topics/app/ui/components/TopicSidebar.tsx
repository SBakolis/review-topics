import type { ReviewComment, ReviewTopic } from "../../shared/schema";

type Props = {
  topics: ReviewTopic[];
  selectedTopicId: string;
  comments: ReviewComment[];
  onSelect: (topic: ReviewTopic) => void;
};

export function TopicSidebar({ topics, selectedTopicId, comments, onSelect }: Props) {
  return (
    <aside className="topic-sidebar">
      <h2>Topics</h2>
      {topics.map((topic) => {
        const commentCount = comments.filter(
          (comment) => comment.topicId === topic.id,
        ).length;
        const className =
          topic.id === selectedTopicId ? "topic-item selected" : "topic-item";
        return (
          <button
            className={className}
            key={topic.id}
            onClick={() => onSelect(topic)}
            type="button"
          >
            <strong className="topic-title">{topic.title}</strong>
            <span className="topic-meta">{topic.files.length} files</span>
            <span className="topic-meta">{commentCount} comments</span>
          </button>
        );
      })}
    </aside>
  );
}
