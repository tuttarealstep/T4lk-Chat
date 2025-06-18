import { isToday, isYesterday, subMonths } from 'date-fns'
import type { Thread, ThreadGroup } from '~/stores/chat'

interface GroupLabels {
    pinned: string
    today: string
    yesterday: string
    lastWeek: string
    lastMonth: string
}

export function groupThreadsByDate(threads: Thread[], labels: GroupLabels): ThreadGroup[] {
    // Separate pinned and regular threads
    const pinnedThreads = threads.filter(thread => thread.pinned)
    const regularThreads = threads.filter(thread => !thread.pinned)

    // Group regular threads by date
    const today: Thread[] = []
    const yesterday: Thread[] = []
    const lastWeek: Thread[] = []
    const lastMonth: Thread[] = []
    const older: Record<string, Thread[]> = {}

    const oneWeekAgo = subMonths(new Date(), 0.25)  // 1 week ago
    const oneMonthAgo = subMonths(new Date(), 1)

    regularThreads.forEach((thread) => {
        const threadDate = thread.updatedAt ? new Date(thread.updatedAt) : new Date(thread.createdAt)

        if (isToday(threadDate)) {
            today.push(thread)
        } else if (isYesterday(threadDate)) {
            yesterday.push(thread)
        } else if (threadDate >= oneWeekAgo) {
            lastWeek.push(thread)
        } else if (threadDate >= oneMonthAgo) {
            lastMonth.push(thread)
        } else {
            const monthYear = threadDate.toLocaleDateString(undefined, {
                month: 'long',
                year: 'numeric'
            })

            if (!older[monthYear]) {
                older[monthYear] = []
            }
            older[monthYear].push(thread)
        }
    })

    // Sort older threads by month-year (newest first)
    const sortedMonthYears = Object.keys(older).sort((a, b) => {
        const dateA = new Date(a)
        const dateB = new Date(b)
        return dateB.getTime() - dateA.getTime()
    })

    // Build final groups array
    const groups: ThreadGroup[] = []
    // Add pinned threads group if there are any
    if (pinnedThreads.length > 0) {
        groups.push({
            id: 'pinned',
            label: labels.pinned,
            items: pinnedThreads.sort((a, b) => {
                const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt)
                const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt)
                return dateB.getTime() - dateA.getTime()
            })
        })
    }

    // Add other groups if they have threads
    if (today.length > 0) {
        groups.push({
            id: 'today',
            label: labels.today,
            items: today.sort((a, b) => {
                const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt)
                const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt)
                return dateB.getTime() - dateA.getTime()
            })
        })
    }

    if (yesterday.length > 0) {
        groups.push({
            id: 'yesterday',
            label: labels.yesterday,
            items: yesterday.sort((a, b) => {
                const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt)
                const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt)
                return dateB.getTime() - dateA.getTime()
            })
        })
    }

    if (lastWeek.length > 0) {
        groups.push({
            id: 'lastWeek',
            label: labels.lastWeek,
            items: lastWeek.sort((a, b) => {
                const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt)
                const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt)
                return dateB.getTime() - dateA.getTime()
            })
        })
    }

    if (lastMonth.length > 0) {
        groups.push({
            id: 'lastMonth',
            label: labels.lastMonth,
            items: lastMonth.sort((a, b) => {
                const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt)
                const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt)
                return dateB.getTime() - dateA.getTime()
            })
        })
    }

    // Add older groups
    sortedMonthYears.forEach(monthYear => {
        if (older[monthYear] && older[monthYear].length > 0) {
            groups.push({
                id: monthYear.replace(/\s+/g, '-').toLowerCase(),
                label: monthYear,
                items: older[monthYear].sort((a, b) => {
                    const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt)
                    const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.createdAt)
                    return dateB.getTime() - dateA.getTime()
                })
            })
        }
    })

    return groups
}
