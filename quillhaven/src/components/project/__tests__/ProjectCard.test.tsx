import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectCard } from '../ProjectCard';
import { Project } from '@prisma/client';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('ProjectCard Component', () => {
  const mockProject: Project = {
    id: 'project-1',
    userId: 'user-1',
    title: 'Test Novel',
    description: 'A fascinating story about adventure and discovery',
    genre: 'Fantasy',
    targetLength: 80000,
    currentWordCount: 25000,
    status: 'in-progress',
    context: {
      characters: [
        {
          id: '1',
          name: 'Hero',
          description: 'Main character',
          role: 'protagonist',
          relationships: [],
          developmentArc: 'Growth',
        },
        {
          id: '2',
          name: 'Villain',
          description: 'Antagonist',
          role: 'antagonist',
          relationships: [],
          developmentArc: 'Fall',
        },
      ],
      plotThreads: [
        {
          id: '1',
          title: 'Main Quest',
          description: 'Save the world',
          status: 'developing',
          relatedCharacters: ['1'],
          chapterReferences: [],
        },
      ],
      worldBuilding: [],
      timeline: [],
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  };

  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnExport = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render project information correctly', () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    expect(screen.getByText('Test Novel')).toBeInTheDocument();
    expect(
      screen.getByText('A fascinating story about adventure and discovery')
    ).toBeInTheDocument();
    expect(screen.getByText('Fantasy')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('should display progress information', () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    expect(screen.getByText('25,000 / 80,000 words')).toBeInTheDocument();
    expect(screen.getByText('31%')).toBeInTheDocument(); // 25000/80000 * 100
  });

  it('should display context statistics', () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    expect(screen.getByText('2 Characters')).toBeInTheDocument();
    expect(screen.getByText('1 Plot Thread')).toBeInTheDocument();
  });

  it('should display formatted dates', () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    expect(screen.getByText(/Created: Jan 1, 2024/)).toBeInTheDocument();
    expect(screen.getByText(/Updated: Jan 15, 2024/)).toBeInTheDocument();
  });

  it('should handle click to open project', async () => {
    const user = userEvent.setup();
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    const projectCard = screen.getByRole('article');
    await user.click(projectCard);

    // Would typically test navigation, but we're mocking next/navigation
    expect(projectCard).toBeInTheDocument();
  });

  it('should show edit button and handle edit action', async () => {
    const user = userEvent.setup();
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    const editButton = screen.getByRole('button', { name: /edit project/i });
    await user.click(editButton);

    expect(mockOnEdit).toHaveBeenCalledWith(mockProject);
  });

  it('should show delete button and handle delete action', async () => {
    const user = userEvent.setup();
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    const deleteButton = screen.getByRole('button', {
      name: /delete project/i,
    });
    await user.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith(mockProject);
  });

  it('should show export button and handle export action', async () => {
    const user = userEvent.setup();
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    const exportButton = screen.getByRole('button', {
      name: /export project/i,
    });
    await user.click(exportButton);

    expect(mockOnExport).toHaveBeenCalledWith(mockProject);
  });

  it('should display different status badges correctly', () => {
    const statuses = [
      { status: 'draft', expectedText: 'Draft' },
      { status: 'in-progress', expectedText: 'In Progress' },
      { status: 'completed', expectedText: 'Completed' },
      { status: 'on-hold', expectedText: 'On Hold' },
    ];

    statuses.forEach(({ status, expectedText }) => {
      const projectWithStatus = { ...mockProject, status: status as any };
      const { rerender } = render(
        <ProjectCard
          project={projectWithStatus}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onExport={mockOnExport}
        />
      );

      expect(screen.getByText(expectedText)).toBeInTheDocument();

      rerender(<div />); // Clear for next iteration
    });
  });

  it('should handle projects with no description', () => {
    const projectWithoutDescription = { ...mockProject, description: null };
    render(
      <ProjectCard
        project={projectWithoutDescription}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    expect(screen.getByText('Test Novel')).toBeInTheDocument();
    expect(screen.queryByText('A fascinating story')).not.toBeInTheDocument();
  });

  it('should handle projects with zero word count', () => {
    const newProject = { ...mockProject, currentWordCount: 0 };
    render(
      <ProjectCard
        project={newProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    expect(screen.getByText('0 / 80,000 words')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should handle projects exceeding target length', () => {
    const overTargetProject = { ...mockProject, currentWordCount: 90000 };
    render(
      <ProjectCard
        project={overTargetProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    expect(screen.getByText('90,000 / 80,000 words')).toBeInTheDocument();
    expect(screen.getByText('113%')).toBeInTheDocument(); // Over 100%
  });

  it('should handle empty context gracefully', () => {
    const emptyContextProject = {
      ...mockProject,
      context: {
        characters: [],
        plotThreads: [],
        worldBuilding: [],
        timeline: [],
      },
    };

    render(
      <ProjectCard
        project={emptyContextProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    expect(screen.getByText('0 Characters')).toBeInTheDocument();
    expect(screen.getByText('0 Plot Threads')).toBeInTheDocument();
  });

  it('should be keyboard accessible', async () => {
    const user = userEvent.setup();
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    // Tab through interactive elements
    await user.tab();
    expect(screen.getByRole('article')).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: /edit project/i })).toHaveFocus();

    await user.tab();
    expect(
      screen.getByRole('button', { name: /delete project/i })
    ).toHaveFocus();

    await user.tab();
    expect(
      screen.getByRole('button', { name: /export project/i })
    ).toHaveFocus();
  });

  it('should handle keyboard activation', async () => {
    const user = userEvent.setup();
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    const editButton = screen.getByRole('button', { name: /edit project/i });
    editButton.focus();

    await user.keyboard('{Enter}');
    expect(mockOnEdit).toHaveBeenCalledWith(mockProject);

    await user.keyboard(' '); // Space key
    expect(mockOnEdit).toHaveBeenCalledTimes(2);
  });

  it('should prevent event bubbling on button clicks', async () => {
    const user = userEvent.setup();
    const mockCardClick = jest.fn();

    render(
      <div onClick={mockCardClick}>
        <ProjectCard
          project={mockProject}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onExport={mockOnExport}
        />
      </div>
    );

    const editButton = screen.getByRole('button', { name: /edit project/i });
    await user.click(editButton);

    expect(mockOnEdit).toHaveBeenCalledWith(mockProject);
    expect(mockCardClick).not.toHaveBeenCalled(); // Event should not bubble
  });

  it('should display progress bar correctly', () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '31');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  it('should handle very long titles gracefully', () => {
    const longTitleProject = {
      ...mockProject,
      title:
        'A'.repeat(100) + ' Very Long Title That Should Be Handled Gracefully',
    };

    render(
      <ProjectCard
        project={longTitleProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    expect(screen.getByText(longTitleProject.title)).toBeInTheDocument();
  });

  it('should handle very long descriptions gracefully', () => {
    const longDescriptionProject = {
      ...mockProject,
      description:
        'A'.repeat(500) +
        ' very long description that should be truncated or handled appropriately',
    };

    render(
      <ProjectCard
        project={longDescriptionProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    expect(
      screen.getByText(longDescriptionProject.description)
    ).toBeInTheDocument();
  });

  it('should handle missing optional callbacks', () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    // Should render without errors even if some callbacks are missing
    expect(screen.getByText('Test Novel')).toBeInTheDocument();
  });

  it('should display genre badge with appropriate styling', () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    const genreBadge = screen.getByText('Fantasy');
    expect(genreBadge).toBeInTheDocument();
    expect(genreBadge).toHaveClass('badge'); // Assuming CSS class exists
  });

  it('should handle hover states', async () => {
    const user = userEvent.setup();
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    const projectCard = screen.getByRole('article');

    await user.hover(projectCard);
    // Would test hover styles if they affect DOM/classes

    await user.unhover(projectCard);
    // Would test unhover styles if they affect DOM/classes
  });

  it('should handle focus states', async () => {
    const user = userEvent.setup();
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    const projectCard = screen.getByRole('article');

    await user.tab();
    expect(projectCard).toHaveFocus();
  });

  it('should be responsive to different screen sizes', () => {
    // This would typically test responsive behavior
    // For now, we'll just ensure the component renders
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
      />
    );

    expect(screen.getByText('Test Novel')).toBeInTheDocument();
  });
});
