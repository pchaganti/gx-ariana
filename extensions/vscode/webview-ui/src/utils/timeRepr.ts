export const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diffMs = now - (timestamp * 1000);
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);

    // Format date for display with time
    const formatDate = (date: Date) => {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'pm' : 'am';
        const formattedHours = hours % 12 || 12;
        const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
        return `${formattedHours}:${formattedMinutes}${ampm}`;
    };

    if (diffSec < 60) {
        return `${diffSec} seconds ago`;
    } else if (diffMin < 60) {
        return `${diffMin} minutes ago`;
    } else if (diffHour < 48) {
        return `${diffHour} hours ago`;
    } else if (diffDay < 7) {
        return `${diffDay} days ago at ${formatDate(new Date(timestamp))}`;
    } else if (diffWeek < 4) {
        return `${diffWeek} weeks ago`;
    } else {
        return `${diffMonth} months ago`;
    }
};