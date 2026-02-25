import leetcode from './leetcode.js'
import jobs from './jobs.js'
import activity from './activity.js'
import gaming from './gaming.js'
import resume from './resume.js'

export const TRACKER_CONFIGS = {
  [leetcode.id]: leetcode,
  [jobs.id]: jobs,
  [activity.id]: activity,
  [gaming.id]: gaming,
  [resume.id]: resume,
}

export const TRACKER_LIST = Object.values(TRACKER_CONFIGS)
