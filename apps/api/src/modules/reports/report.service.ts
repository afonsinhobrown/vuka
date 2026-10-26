import { prisma } from '../../lib/prisma';
import { OrderStatus, SalesReportDTO } from '@vuka/shared';

export class ReportService {
  static async getSalesReport(options: {
    publisherId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<SalesReportDTO> {
    const { publisherId } = options;
    const where: any = {};

    if (publisherId) {
      where.offer = { publisherId };
    }

    const [totalOrders, paidOrders, paidOrdersList] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.count({ where: { ...where, status: OrderStatus.PAID } }),
      prisma.order.findMany({
        where: { ...where, status: OrderStatus.PAID },
        include: {
          offer: {
            include: {
              publisher: true,
              publication: true
            }
          }
        }
      })
    ]);

    let totalRevenueMinorUnits = 0;
    const publisherRevenueMap = new Map<string, { name: string; revenue: number; count: number }>();
    const publicationRevenueMap = new Map<string, { title: string; revenue: number; count: number }>();
    const periodMap = new Map<string, { revenue: number; count: number }>();

    for (const order of paidOrdersList) {
      totalRevenueMinorUnits += order.totalMinorUnits;

      // Por Editora
      const pubId = order.offer.publisherId || 'platform';
      const pubName = order.offer.publisher?.name || 'VUKA Plataforma';
      const currentPub = publisherRevenueMap.get(pubId) || { name: pubName, revenue: 0, count: 0 };
      currentPub.revenue += order.totalMinorUnits;
      currentPub.count += 1;
      publisherRevenueMap.set(pubId, currentPub);

      // Por Publicação
      const publicationId = order.offer.publicationId || 'geral';
      const publicationTitle = order.offer.publication?.title || 'Publicações Diversas';
      const currentPublication = publicationRevenueMap.get(publicationId) || {
        title: publicationTitle,
        revenue: 0,
        count: 0
      };
      currentPublication.revenue += order.totalMinorUnits;
      currentPublication.count += 1;
      publicationRevenueMap.set(publicationId, currentPublication);

      // Por Dia/Data
      const dateKey = order.createdAt.toISOString().split('T')[0];
      const currentPeriod = periodMap.get(dateKey) || { revenue: 0, count: 0 };
      currentPeriod.revenue += order.totalMinorUnits;
      currentPeriod.count += 1;
      periodMap.set(dateKey, currentPeriod);
    }

    const byPublisher = Array.from(publisherRevenueMap.entries()).map(([id, data]) => ({
      publisherId: id,
      publisherName: data.name,
      ordersCount: data.count,
      revenueMinorUnits: data.revenue
    }));

    const byPublication = Array.from(publicationRevenueMap.entries()).map(([id, data]) => ({
      publicationId: id,
      publicationTitle: data.title,
      ordersCount: data.count,
      revenueMinorUnits: data.revenue
    }));

    const byPeriod = Array.from(periodMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date,
        revenueMinorUnits: data.revenue,
        ordersCount: data.count
      }));

    return {
      totalRevenueMinorUnits,
      totalOrders,
      paidOrders,
      currency: 'MZN',
      byPublisher,
      byPublication,
      byPeriod
    };
  }
}
