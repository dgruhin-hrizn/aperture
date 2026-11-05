import type { ToolSet } from 'ai'
import type { ToolContext } from '../types.js'
import {createGetContentRankingsTool} from './getContentRankings.js'
import {createGetLibraryStatsTool} from './getLibraryStats.js'
import {createGetAvailableGenresTool} from './getAvailableGenres.js'
import {createSearchContentTool} from './searchContent.js'
import {createSemanticSearchTool} from './semanticSearch.js'
import {createFindSimilarContentTool} from './findSimilarContent.js'
import {createGetContentDetailsTool} from './getContentDetails.js'
import {createGetWatchHistoryTool} from './getWatchHistory.js'
import {createGetUserRatingsTool} from './getUserRatings.js'
import {createGetMyRecommendationsTool} from './getMyRecommendations.js'
import {createGetTopRatedTool} from './getTopRated.js'
import {createGetUnwatchedTool} from './getUnwatched.js'
import {createSearchPeopleTool} from './searchPeople.js'
import {createGetTopStudiosTool} from './getTopStudios.js'
import {createGetSystemHelpTool} from './getSystemHelp.js'
import {createSearchByKeywordTool} from './searchByKeyword.js'
import {createGetFranchisesTool} from './getFranchises.js'
import {createGetAwardWinnersTool} from './getAwardWinners.js'
import {createGetTopByRtScoreTool} from './getTopByRtScore.js'
import {createGetFranchiseProgressTool} from './getFranchiseProgress.js'
export function createTools(ctx: ToolContext): ToolSet { return {
...createGetContentRankingsTool(ctx),
...createGetLibraryStatsTool(ctx),
...createGetAvailableGenresTool(ctx),
...createSearchContentTool(ctx),
...createSemanticSearchTool(ctx),
...createFindSimilarContentTool(ctx),
...createGetContentDetailsTool(ctx),
...createGetWatchHistoryTool(ctx),
...createGetUserRatingsTool(ctx),
...createGetMyRecommendationsTool(ctx),
...createGetTopRatedTool(ctx),
...createGetUnwatchedTool(ctx),
...createSearchPeopleTool(ctx),
...createGetTopStudiosTool(ctx),
...createGetSystemHelpTool(ctx),
...createSearchByKeywordTool(ctx),
...createGetFranchisesTool(ctx),
...createGetAwardWinnersTool(ctx),
...createGetTopByRtScoreTool(ctx),
...createGetFranchiseProgressTool(ctx),
}; }
