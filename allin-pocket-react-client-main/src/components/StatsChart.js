import React, { useContext } from 'react';
import styled from 'styled-components';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import contentContext from '@/context/content/contentContext';
import { formatMoney } from '@/utils/Money';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

const ChartWrap = styled.div`
  padding: 8px 4px 0;
`;

const EmptyState = styled.div`
  color: #bfbfbf;
  font-size: 13px;
`;

const StatsChart = ({ userStats }) => {
  const { t } = useContext(contentContext);

  if (!userStats) {
    return <EmptyState>{t('NO_STATISTICS')}</EmptyState>;
  }

  const { labels, averageMoney, averageWinCount, averageLoseCount } = userStats;
  const winRate = (averageWinCount || []).map((win, index) => {
    const lose = Number(averageLoseCount?.[index] || 0);
    const total = Number(win || 0) + lose;
    if (!total) {
      return 0;
    }

    const rate = (Number(win || 0) / total) * 100;
    return Number(rate.toFixed(1));
  });

  const chartData = {
    labels,
    datasets: [
      {
        type: 'bar',
        label: '平均资金',
        data: averageMoney,
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;

          if (!chartArea) {
            return 'rgba(212, 175, 55, 0.75)';
          }

          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(245, 217, 120, 0.95)');
          gradient.addColorStop(0.55, 'rgba(212, 175, 55, 0.82)');
          gradient.addColorStop(1, 'rgba(143, 107, 20, 0.52)');
          return gradient;
        },
        borderColor: 'rgba(245, 217, 120, 1)',
        borderWidth: 1,
        borderRadius: 10,
        yAxisID: 'y',
      },
      {
        type: 'line',
        label: '胜率趋势',
        data: winRate,
        borderColor: 'rgba(255, 243, 179, 1)',
        backgroundColor: 'rgba(255, 243, 179, 0.16)',
        pointBackgroundColor: '#fff3b3',
        pointBorderColor: '#d4af37',
        pointRadius: 4,
        pointHoverRadius: 5,
        borderWidth: 2.5,
        tension: 0.4,
        yAxisID: 'y1',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#f5f5f5',
          usePointStyle: true,
          boxWidth: 10,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(17, 17, 17, 0.96)',
        borderColor: 'rgba(212, 175, 55, 0.28)',
        borderWidth: 1,
        titleColor: '#ffffff',
        bodyColor: '#f5f5f5',
        callbacks: {
          label(context) {
            if (context.dataset.yAxisID === 'y1') {
              return `${context.dataset.label}: ${context.parsed.y}%`;
            }

            return `${context.dataset.label}: ${formatMoney(context.parsed.y)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(212, 175, 55, 0.08)',
        },
        ticks: {
          color: '#d8d8d8',
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(212, 175, 55, 0.08)',
        },
        ticks: {
          color: '#d4af37',
          callback(value) {
            return formatMoney(value);
          },
        },
      },
      y1: {
        position: 'right',
        beginAtZero: true,
        suggestedMax: 100,
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: '#fff3b3',
          callback(value) {
            return `${value}%`;
          },
        },
      },
    },
  };

  return (
    <ChartWrap>
      <div style={{ height: '320px' }}>
        <Chart type="bar" data={chartData} options={options} />
      </div>
    </ChartWrap>
  );
};

export default StatsChart;
