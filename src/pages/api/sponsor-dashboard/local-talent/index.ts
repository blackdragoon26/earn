import type { NextApiResponse } from 'next';

import { Superteams, unofficialSuperteams } from '@/constants/Superteam';
import logger from '@/lib/logger';
import { prisma } from '@/prisma';
import { safeStringify } from '@/utils/safeStringify';

import { type NextApiRequestWithSponsor } from '@/features/auth/types';
import { withSponsorAuth } from '@/features/auth/utils/withSponsorAuth';

async function handler(req: NextApiRequestWithSponsor, res: NextApiResponse) {
  const params = req.query;
  const sponsorId = req.userSponsorId;
  const userId = req.userId;

  logger.debug(`Query params: ${safeStringify(params)}`);

  try {
    const requestingUser = await prisma.user.findUnique({
      where: { id: userId as string },
      select: { stLead: true },
    });

    const sponsoringTeam = await prisma.sponsors.findUnique({
      where: { id: sponsorId },
      select: { name: true },
    });

    const matchedSuperteam =
      Superteams.find(
        (team) =>
          team.name.toLowerCase() === sponsoringTeam?.name.toLowerCase(),
      ) ||
      unofficialSuperteams.find(
        (team) =>
          team.name.toLowerCase() === sponsoringTeam?.name.toLowerCase(),
      );
    if (!matchedSuperteam) {
      return res.status(403).json({ error: 'Invalid sponsor' });
    }

    const superteamRegion = matchedSuperteam.region;
    const superteamCountries = matchedSuperteam.country;

    const canViewLocalProfiles =
      requestingUser?.stLead === superteamRegion ||
      requestingUser?.stLead === 'MAHADEV';

    if (!canViewLocalProfiles) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    logger.debug('Fetching user details');
    const localTalent = await prisma.user.findMany({
      where: { location: { in: superteamCountries } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        skills: true,
        telegram: true,
        twitter: true,
        website: true,
        discord: true,
        username: true,
        photo: true,
        bio: true,
        community: true,
        interests: true,
        createdAt: true,
        Submission: {
          select: {
            isWinner: true,
            rewardInUSD: true,
            listing: {
              select: {
                isWinnersAnnounced: true,
              },
            },
          },
        },
        GrantApplication: {
          select: {
            approvedAmountInUSD: true,
            applicationStatus: true,
          },
        },
      },
    });

    const talentWithStats = localTalent.map((talent) => {
      const totalSubmissions = talent.Submission.length;
      const wins = talent.Submission.filter(
        (s) => s.isWinner && s.listing.isWinnersAnnounced,
      ).length;

      const listingWinnings = talent.Submission.filter(
        (s) => s.isWinner && s.listing.isWinnersAnnounced,
      ).reduce((sum, submission) => sum + (submission.rewardInUSD || 0), 0);

      const grantWinnings = talent.GrantApplication.filter(
        (g) => g.applicationStatus === 'Approved',
      ).reduce(
        (sum, application) => sum + (application.approvedAmountInUSD || 0),
        0,
      );

      const totalEarnings = listingWinnings + grantWinnings;

      return { ...talent, totalSubmissions, wins, totalEarnings };
    });

    const rankedTalent = talentWithStats
      .sort((a, b) => b.totalEarnings - a.totalEarnings)
      .map((talent, index) => ({
        ...talent,
        rank: index + 1,
      }));

    logger.info('Successfully fetched and processed user details');
    res.status(200).json(rankedTalent);
  } catch (error: any) {
    logger.error(
      `Error fetching and processing users: ${safeStringify(error)}`,
    );
    res.status(400).json({ error: 'Error occurred while fetching users.' });
  }
}

export default withSponsorAuth(handler);
